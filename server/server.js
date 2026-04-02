import express from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import mongoose from "mongoose";
import User from "./models/user.js";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL =
  process.env.CLIENT_URL ||
  "http://localhost:5173,https://anon-chat-beige-tau.vercel.app";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anonchat";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-super-secret-key";
const JWT_EXPIRES_IN = "7d";
const MAX_MESSAGE_LENGTH = 1200;
const MAX_USERNAME_LENGTH = 24;
const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 5;
const TYPING_THROTTLE_MS = 1200;
const BRISCOLA_TRICK_RESOLVE_DELAY_MS = 5000;
const BRISCOLA_TRICK_SWEEP_INTERVAL_MS = 500;
const COLOR_TOTAL_ROUNDS = 5;
const COLOR_MEMORIZE_MS = 5000;
const COLOR_GUESS_MS = 60000;
const COLOR_RESULT_MS = 3500;

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(CLIENT_URL);

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error("Origin non consentita dal CORS."));
}

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "200kb" }));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUsers = new Map(); // socketId -> { id, username }
const connectedUsers = new Map(); // userId -> { socketId, sessionId }
const waitingQueue = []; // [{ socketId, userId, username, interests, queuedAt }]
const activeChats = new Map(); // socketId -> partnerSocketId
const typingCooldowns = new Map(); // socketId -> timestamp

const briscolaVotes = new Map(); // roomId -> { start: {socketId:boolean}, end: {socketId:boolean} }
const briscolaGames = new Map(); // roomId -> game state
const colorVotes = new Map(); // roomId -> { start: {socketId:boolean}, end: {socketId:boolean} }
const colorGames = new Map(); // roomId -> color game state

const SUITS = ["coppe", "denar", "spade", "basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const CARD_POINTS = {
  1: 11,
  2: 0,
  3: 10,
  4: 0,
  5: 0,
  6: 0,
  7: 0,
  8: 2,
  9: 3,
  10: 4,
};

const CARD_STRENGTH = {
  1: 10,
  3: 9,
  10: 8,
  9: 7,
  8: 6,
  7: 5,
  6: 4,
  5: 3,
  4: 2,
  2: 1,
};

function normalizeUsername(username) {
  return String(username || "").normalize("NFKC").trim().toLocaleLowerCase("it-IT");
}

function sanitizeUsername(username) {
  return String(username || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, "_")
    .replace(/[^\p{L}\p{N}_.-]/gu, "");
}

function sanitizeInterests(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

function sanitizeMessage(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
}

function createToken(user) {
  return jwt.sign(
    { id: String(user._id || user.id), username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        id: `${String(value).padStart(2, "0")}_${suit}`,
        suit,
        value,
      });
    }
  }
  return shuffle(deck);
}

function cardPoints(card) {
  return CARD_POINTS[card.value] ?? 0;
}

function cardStrength(card) {
  return CARD_STRENGTH[card.value] ?? 0;
}

function cardLabel(card) {
  const names = {
    1: "Asso",
    8: "Fante",
    9: "Cavallo",
    10: "Re",
  };
  const suitNames = {
    coppe: "Coppe",
    denar: "Denari",
    spade: "Spade",
    basto: "Bastoni",
  };
  return `${names[card.value] || card.value} di ${suitNames[card.suit]}`;
}

function roomIdFromPair(a, b) {
  return [a, b].sort().join("__");
}

function getPartnerSocket(socketId) {
  const partnerId = activeChats.get(socketId);
  if (!partnerId) return null;
  return io.sockets.sockets.get(partnerId) || null;
}

function getPartnerId(socketId) {
  return activeChats.get(socketId) || null;
}

function getRoomIdBySocket(socketId) {
  const partnerId = getPartnerId(socketId);
  if (!partnerId) return null;
  return roomIdFromPair(socketId, partnerId);
}

function emitOnlineCount() {
  io.emit("online-count", { count: onlineUsers.size });
}

function getConnectedUserEntry(userId) {
  return connectedUsers.get(String(userId)) || null;
}

function isUserConnected(userId, excludedSocketId = null) {
  const entry = getConnectedUserEntry(userId);
  if (!entry?.socketId) return false;
  if (excludedSocketId && entry.socketId === excludedSocketId) return false;
  return io.sockets.sockets.has(entry.socketId);
}

function disconnectUser(socketId) {
  if (!socketId) return;
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return;
  socket.emit("force-logout", {
    message: "Questo account è già connesso in un'altra sessione.",
  });
  socket.disconnect(true);
}

function removeFromQueue(socketId) {
  const index = waitingQueue.findIndex((entry) => entry.socketId === socketId);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
}

function initVoteState(roomId, socketA, socketB) {
  briscolaVotes.set(roomId, {
    start: {
      [socketA]: false,
      [socketB]: false,
    },
    end: {
      [socketA]: false,
      [socketB]: false,
    },
  });
}

function resetVoteState(roomId) {
  const voteState = briscolaVotes.get(roomId);
  if (!voteState) return;
  Object.keys(voteState.start).forEach((key) => {
    voteState.start[key] = false;
  });
  Object.keys(voteState.end).forEach((key) => {
    voteState.end[key] = false;
  });
}

function clearBriscolaRoom(roomId) {
  const game = briscolaGames.get(roomId);
  if (game?.pendingTrickTimeout) {
    clearTimeout(game.pendingTrickTimeout);
  }
  briscolaVotes.delete(roomId);
  briscolaGames.delete(roomId);
}

function initColorVoteState(roomId, socketA, socketB) {
  colorVotes.set(roomId, {
    start: {
      [socketA]: false,
      [socketB]: false,
    },
    end: {
      [socketA]: false,
      [socketB]: false,
    },
  });
}

function resetColorVoteState(roomId) {
  const voteState = colorVotes.get(roomId);
  if (!voteState) return;
  Object.keys(voteState.start).forEach((key) => {
    voteState.start[key] = false;
  });
  Object.keys(voteState.end).forEach((key) => {
    voteState.end[key] = false;
  });
}

function clearColorRoom(roomId) {
  const game = colorGames.get(roomId);
  if (game?.pendingPhaseTimeout) {
    clearTimeout(game.pendingPhaseTimeout);
  }
  colorVotes.delete(roomId);
  colorGames.delete(roomId);
}

function isAnotherGameActive(roomId, gameName) {
  if (gameName !== "briscola" && briscolaGames.has(roomId)) return true;
  if (gameName !== "color" && colorGames.has(roomId)) return true;
  return false;
}

function emitColorVoteState(roomId) {
  const voteState = colorVotes.get(roomId);
  if (!voteState) return;

  const sockets = Object.keys(voteState.start);
  if (sockets.length !== 2) return;

  const [a, b] = sockets;
  const socketA = io.sockets.sockets.get(a);
  const socketB = io.sockets.sockets.get(b);
  if (!socketA || !socketB) return;

  const gameActive = colorGames.has(roomId);
  const mode = gameActive ? "end" : "start";
  const source = gameActive ? voteState.end : voteState.start;

  socketA.emit("color-vote-update", {
    mode,
    myVote: !!source[a],
    peerVote: !!source[b],
  });

  socketB.emit("color-vote-update", {
    mode,
    myVote: !!source[b],
    peerVote: !!source[a],
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hslToRgb(h, s, l) {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;

  if (sat === 0) {
    const gray = Math.round(light * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const toChannel = (t) => {
    let temp = t;
    if (temp < 0) temp += 1;
    if (temp > 1) temp -= 1;
    if (temp < 1 / 6) return p + (q - p) * 6 * temp;
    if (temp < 1 / 2) return q;
    if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
    return p;
  };

  return {
    r: Math.round(toChannel(hue + 1 / 3) * 255),
    g: Math.round(toChannel(hue) * 255),
    b: Math.round(toChannel(hue - 1 / 3) * 255),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function createColorValue(h, s, l) {
  const value = {
    h: Math.round(clamp(h, 0, 359)),
    s: Math.round(clamp(s, 0, 100)),
    l: Math.round(clamp(l, 0, 100)),
  };
  const rgb = hslToRgb(value.h, value.s, value.l);
  return {
    ...value,
    hex: rgbToHex(rgb),
    rgb,
  };
}

function randomColorTarget() {
  return createColorValue(
    Math.floor(Math.random() * 360),
    45 + Math.floor(Math.random() * 46),
    30 + Math.floor(Math.random() * 41)
  );
}

function scoreColorGuess(target, guess) {
  const targetRgb = target.rgb;
  const guessRgb = guess.rgb;
  const distance = Math.sqrt(
    (targetRgb.r - guessRgb.r) ** 2 +
      (targetRgb.g - guessRgb.g) ** 2 +
      (targetRgb.b - guessRgb.b) ** 2
  );
  const maxDistance = Math.sqrt(255 ** 2 * 3);
  return Math.round((1 - distance / maxDistance) * 100);
}

function emitBriscolaVoteState(roomId) {
  const voteState = briscolaVotes.get(roomId);
  if (!voteState) return;

  const sockets = Object.keys(voteState.start);
  if (sockets.length !== 2) return;

  const [a, b] = sockets;
  const socketA = io.sockets.sockets.get(a);
  const socketB = io.sockets.sockets.get(b);
  if (!socketA || !socketB) return;

  const gameActive = briscolaGames.has(roomId);
  const mode = gameActive ? "end" : "start";
  const source = gameActive ? voteState.end : voteState.start;

  socketA.emit("briscola-vote-update", {
    mode,
    myVote: !!source[a],
    peerVote: !!source[b],
  });

  socketB.emit("briscola-vote-update", {
    mode,
    myVote: !!source[b],
    peerVote: !!source[a],
  });
}

function createBriscolaGame(roomId, socketA, socketB) {
  const freshDeck = buildDeck();

  const handA = [freshDeck[0], freshDeck[2], freshDeck[4]];
  const handB = [freshDeck[1], freshDeck[3], freshDeck[5]];
  const briscolaCard = freshDeck[6];
  const drawPile = freshDeck.slice(7);

  const starter = Math.random() < 0.5 ? socketA : socketB;

  briscolaGames.set(roomId, {
    roomId,
    players: [socketA, socketB],
    usernames: {
      [socketA]: onlineUsers.get(socketA)?.username || "Giocatore 1",
      [socketB]: onlineUsers.get(socketB)?.username || "Giocatore 2",
    },
    hands: {
      [socketA]: handA,
      [socketB]: handB,
    },
    points: {
      [socketA]: 0,
      [socketB]: 0,
    },
    briscolaCard,
    briscolaAvailable: true,
    drawPile,
    tableCards: [],
    turn: starter,
    status: `Partita iniziata. Tocca a ${onlineUsers.get(starter)?.username || "un giocatore"}.`,
    gameOver: false,
    winner: null,
    pendingTrickTimeout: null,
    pendingTrickResolvesAt: null,
  });
}

function getTrickWinner(first, second, briscolaSuit) {
  const firstCard = first.card;
  const secondCard = second.card;

  const firstIsBriscola = firstCard.suit === briscolaSuit;
  const secondIsBriscola = secondCard.suit === briscolaSuit;

  if (firstIsBriscola && !secondIsBriscola) return first.playerId;
  if (!firstIsBriscola && secondIsBriscola) return second.playerId;

  if (firstCard.suit === secondCard.suit) {
    return cardStrength(firstCard) >= cardStrength(secondCard)
      ? first.playerId
      : second.playerId;
  }

  return first.playerId;
}

function drawForPlayer(game, playerId) {
  if (game.drawPile.length > 0) {
    const card = game.drawPile.shift();
    if (card) {
      game.hands[playerId].push(card);
    }
    return;
  }

  if (game.briscolaAvailable) {
    game.hands[playerId].push(game.briscolaCard);
    game.briscolaAvailable = false;
  }
}

function maybeFinishGame(game) {
  const [a, b] = game.players;
  const noCardsLeft =
    game.hands[a].length === 0 &&
    game.hands[b].length === 0 &&
    game.drawPile.length === 0 &&
    !game.briscolaAvailable &&
    game.tableCards.length === 0;

  if (!noCardsLeft) return;

  game.gameOver = true;

  if (game.points[a] > game.points[b]) {
    game.winner = a;
    game.status = `${game.usernames[a]} ha vinto la partita.`;
  } else if (game.points[b] > game.points[a]) {
    game.winner = b;
    game.status = `${game.usernames[b]} ha vinto la partita.`;
  } else {
    game.winner = "draw";
    game.status = "La partita è finita in pareggio.";
  }
}

function resolveTrick(game) {
  if (game.tableCards.length !== 2) return;

  if (game.pendingTrickTimeout) {
    clearTimeout(game.pendingTrickTimeout);
    game.pendingTrickTimeout = null;
  }
  game.pendingTrickResolvesAt = null;

  const [first, second] = game.tableCards;
  const winnerId = getTrickWinner(first, second, game.briscolaCard.suit);
  const loserId = winnerId === first.playerId ? second.playerId : first.playerId;
  const points = cardPoints(first.card) + cardPoints(second.card);

  game.points[winnerId] += points;
  drawForPlayer(game, winnerId);
  drawForPlayer(game, loserId);
  game.tableCards = [];
  game.turn = winnerId;
  game.status = `${game.usernames[winnerId]} ha preso la mano e ottenuto ${points} punti.`;

  maybeFinishGame(game);
}

function serializeGameForPlayer(game, playerId) {
  const partnerId = game.players.find((id) => id !== playerId);
  const myHand = game.hands[playerId] || [];
  const opponentHand = game.hands[partnerId] || [];
  const myPoints = game.points[playerId] || 0;
  const opponentPoints = game.points[partnerId] || 0;

  return {
    myHand,
    opponentHandCount: opponentHand.length,
    tableCards: game.tableCards.map((entry) => ({
      player: entry.playerId === playerId ? "me" : "opponent",
      card: entry.card,
    })),
    myPoints,
    opponentPoints,
    deckCount: game.drawPile.length + (game.briscolaAvailable ? 1 : 0),
    briscolaCard: game.briscolaCard,
    briscolaAvailable: game.briscolaAvailable,
    amITurn: game.turn === playerId,
    status: game.status,
    gameOver: game.gameOver,
    winner:
      game.winner === null
        ? null
        : game.winner === "draw"
        ? "draw"
        : game.winner === playerId
        ? "me"
        : "opponent",
  };
}

function emitBriscolaState(roomId) {
  const game = briscolaGames.get(roomId);
  if (!game) return;

  game.players.forEach((playerId) => {
    const socket = io.sockets.sockets.get(playerId);
    if (!socket) return;
    socket.emit("briscola-state", serializeGameForPlayer(game, playerId));
  });
}

function scheduleColorPhase(game, delay, callback) {
  if (game.pendingPhaseTimeout) {
    clearTimeout(game.pendingPhaseTimeout);
  }

  game.phaseEndsAt = Date.now() + delay;
  game.pendingPhaseTimeout = setTimeout(() => {
    game.pendingPhaseTimeout = null;
    callback();
  }, delay);
}

function startColorGuessPhase(game) {
  game.phase = "guess";
  game.status = `Round ${game.round}/${game.totalRounds}. Ricrea il colore entro 60 secondi.`;
  scheduleColorPhase(game, COLOR_GUESS_MS, () => {
    resolveColorRound(game.roomId);
  });
}

function startNextColorRound(game) {
  game.round += 1;
  game.phase = "memorize";
  game.targetColor = randomColorTarget();
  game.guesses = {};
  game.submitted = {};
  game.roundScores = {};
  game.lastRoundResult = null;
  game.status = `Round ${game.round}/${game.totalRounds}. Memorizza il colore.`;
  scheduleColorPhase(game, COLOR_MEMORIZE_MS, () => {
    startColorGuessPhase(game);
    emitColorState(game.roomId);
  });
}

function finishColorGame(game) {
  game.gameOver = true;
  game.phase = "finished";
  game.phaseEndsAt = null;

  const [a, b] = game.players;
  const scoreA = game.totalScores[a] || 0;
  const scoreB = game.totalScores[b] || 0;

  if (scoreA > scoreB) {
    game.winner = a;
    game.status = `${game.usernames[a]} ha vinto a Color.`;
  } else if (scoreB > scoreA) {
    game.winner = b;
    game.status = `${game.usernames[b]} ha vinto a Color.`;
  } else {
    game.winner = "draw";
    game.status = "Color è finito in pareggio.";
  }
}

function resolveColorRound(roomId) {
  const game = colorGames.get(roomId);
  if (!game || game.gameOver || game.phase !== "guess") return;

  if (game.pendingPhaseTimeout) {
    clearTimeout(game.pendingPhaseTimeout);
    game.pendingPhaseTimeout = null;
  }

  const fallbackGuess = createColorValue(180, 50, 50);

  game.players.forEach((playerId) => {
    const guess = game.guesses[playerId] || fallbackGuess;
    const score = scoreColorGuess(game.targetColor, guess);
    game.guesses[playerId] = guess;
    game.submitted[playerId] = true;
    game.roundScores[playerId] = score;
    game.totalScores[playerId] = (game.totalScores[playerId] || 0) + score;
  });

  const [a, b] = game.players;
  game.phase = "result";
  game.lastRoundResult = {
    targetColor: game.targetColor,
    guesses: {
      [a]: game.guesses[a],
      [b]: game.guesses[b],
    },
    scores: {
      [a]: game.roundScores[a],
      [b]: game.roundScores[b],
    },
  };

  const lastRound = game.round >= game.totalRounds;
  if (lastRound) {
    finishColorGame(game);
    emitColorState(roomId);
    return;
  }

  game.status = `Round ${game.round}/${game.totalRounds} completato.`;
  scheduleColorPhase(game, COLOR_RESULT_MS, () => {
    startNextColorRound(game);
    emitColorState(roomId);
  });
}

function createColorGame(roomId, socketA, socketB) {
  const game = {
    roomId,
    players: [socketA, socketB],
    usernames: {
      [socketA]: onlineUsers.get(socketA)?.username || "Giocatore 1",
      [socketB]: onlineUsers.get(socketB)?.username || "Giocatore 2",
    },
    round: 0,
    totalRounds: COLOR_TOTAL_ROUNDS,
    phase: "memorize",
    phaseEndsAt: null,
    targetColor: randomColorTarget(),
    guesses: {},
    submitted: {},
    roundScores: {},
    totalScores: {
      [socketA]: 0,
      [socketB]: 0,
    },
    lastRoundResult: null,
    pendingPhaseTimeout: null,
    gameOver: false,
    winner: null,
    status: "",
  };

  colorGames.set(roomId, game);
  startNextColorRound(game);
}

function serializeColorForPlayer(game, playerId) {
  const partnerId = game.players.find((id) => id !== playerId);
  const canSeeTarget =
    game.phase === "memorize" || game.phase === "result" || game.phase === "finished";

  return {
    round: game.round,
    totalRounds: game.totalRounds,
    phase: game.phase,
    phaseEndsAt: game.phaseEndsAt,
    status: game.status,
    targetColor: canSeeTarget ? game.targetColor : null,
    myGuess: game.guesses[playerId] || null,
    opponentSubmitted: !!game.submitted[partnerId],
    mySubmitted: !!game.submitted[playerId],
    myRoundScore: game.roundScores[playerId] ?? null,
    opponentRoundScore: game.roundScores[partnerId] ?? null,
    myTotalScore: game.totalScores[playerId] || 0,
    opponentTotalScore: game.totalScores[partnerId] || 0,
    gameOver: game.gameOver,
    winner:
      game.winner === null
        ? null
        : game.winner === "draw"
        ? "draw"
        : game.winner === playerId
        ? "me"
        : "opponent",
    revealResult:
      game.lastRoundResult && (game.phase === "result" || game.phase === "finished")
        ? {
            targetColor: game.lastRoundResult.targetColor,
            myGuess: game.lastRoundResult.guesses[playerId],
            opponentGuess: game.lastRoundResult.guesses[partnerId],
            myScore: game.lastRoundResult.scores[playerId],
            opponentScore: game.lastRoundResult.scores[partnerId],
          }
        : null,
  };
}

function emitColorState(roomId) {
  const game = colorGames.get(roomId);
  if (!game) return;

  game.players.forEach((playerId) => {
    const socket = io.sockets.sockets.get(playerId);
    if (!socket) return;
    socket.emit("color-state", serializeColorForPlayer(game, playerId));
  });
}

function handleColorVote(socket, payload = {}) {
  const partnerId = getPartnerId(socket.id);
  const roomId = getRoomIdBySocket(socket.id);

  if (!partnerId || !roomId) {
    socket.emit("error-message", { message: "Nessuna chat attiva." });
    return;
  }

  const voteState = colorVotes.get(roomId);
  if (!voteState) {
    initColorVoteState(roomId, socket.id, partnerId);
  }

  const state = colorVotes.get(roomId);
  if (!state) return;

  const mode = payload.mode;
  const active = Boolean(payload.active);

  if (mode !== "start" && mode !== "end") return;

  const gameExists = colorGames.has(roomId);

  if (!gameExists && mode === "end") return;
  if (gameExists && mode === "start") return;

  if (mode === "start") {
    if (isAnotherGameActive(roomId, "color")) {
      socket.emit("error-message", { message: "Chiudi l'altro minigame prima di avviare Color." });
      return;
    }

    state.end[socket.id] = false;
    state.end[partnerId] = false;
    state.start[socket.id] = active;
    emitColorVoteState(roomId);

    if (state.start[socket.id] && state.start[partnerId]) {
      createColorGame(roomId, socket.id, partnerId);
      resetColorVoteState(roomId);

      const partnerSocket = io.sockets.sockets.get(partnerId);
      socket.emit("color-started");
      if (partnerSocket) partnerSocket.emit("color-started");
      emitColorState(roomId);
    }

    return;
  }

  state.start[socket.id] = false;
  state.start[partnerId] = false;
  state.end[socket.id] = active;
  emitColorVoteState(roomId);

  if (state.end[socket.id] && state.end[partnerId]) {
    clearColorRoom(roomId);
    resetColorVoteState(roomId);

    const partnerSocket = io.sockets.sockets.get(partnerId);
    socket.emit("color-ended");
    if (partnerSocket) partnerSocket.emit("color-ended");
    emitColorVoteState(roomId);
  }
}

function handleColorSubmit(socket, payload = {}) {
  const roomId = getRoomIdBySocket(socket.id);
  if (!roomId) {
    socket.emit("error-message", { message: "Nessuna partita attiva." });
    return;
  }

  const game = colorGames.get(roomId);
  if (!game) {
    socket.emit("error-message", { message: "Nessuna partita di Color attiva." });
    return;
  }

  if (game.gameOver || game.phase !== "guess") {
    socket.emit("error-message", { message: "Non è il momento di inviare il colore." });
    return;
  }

  const guess = createColorValue(
    Number(payload.h ?? 180),
    Number(payload.s ?? 50),
    Number(payload.l ?? 50)
  );

  game.guesses[socket.id] = guess;
  game.submitted[socket.id] = true;
  emitColorState(roomId);

  if (game.players.every((playerId) => game.submitted[playerId])) {
    resolveColorRound(roomId);
    emitColorState(roomId);
  }
}

function handleBriscolaVote(socket, payload = {}) {
  const partnerId = getPartnerId(socket.id);
  const roomId = getRoomIdBySocket(socket.id);

  if (!partnerId || !roomId) {
    socket.emit("error-message", { message: "Nessuna chat attiva." });
    return;
  }

  const voteState = briscolaVotes.get(roomId);
  if (!voteState) {
    initVoteState(roomId, socket.id, partnerId);
  }

  const state = briscolaVotes.get(roomId);
  if (!state) return;

  const mode = payload.mode;
  const active = Boolean(payload.active);

  if (mode !== "start" && mode !== "end") return;

  const gameExists = briscolaGames.has(roomId);

  if (!gameExists && mode === "end") return;
  if (gameExists && mode === "start") return;

  if (mode === "start") {
    if (isAnotherGameActive(roomId, "briscola")) {
      socket.emit("error-message", { message: "Chiudi l'altro minigame prima di avviare la Briscola." });
      return;
    }

    state.end[socket.id] = false;
    state.end[partnerId] = false;
    state.start[socket.id] = active;
    emitBriscolaVoteState(roomId);

    if (state.start[socket.id] && state.start[partnerId]) {
      createBriscolaGame(roomId, socket.id, partnerId);
      resetVoteState(roomId);

      const partnerSocket = io.sockets.sockets.get(partnerId);
      socket.emit("briscola-started");
      if (partnerSocket) partnerSocket.emit("briscola-started");
      emitBriscolaState(roomId);
    }

    return;
  }

  state.start[socket.id] = false;
  state.start[partnerId] = false;
  state.end[socket.id] = active;
  emitBriscolaVoteState(roomId);

  if (state.end[socket.id] && state.end[partnerId]) {
    briscolaGames.delete(roomId);
    resetVoteState(roomId);

    const partnerSocket = io.sockets.sockets.get(partnerId);
    socket.emit("briscola-ended");
    if (partnerSocket) partnerSocket.emit("briscola-ended");
    emitBriscolaVoteState(roomId);
  }
}

function handleBriscolaPlayCard(socket, payload = {}) {
  const roomId = getRoomIdBySocket(socket.id);
  if (!roomId) {
    socket.emit("error-message", { message: "Nessuna partita attiva." });
    return;
  }

  const game = briscolaGames.get(roomId);
  if (!game) {
    socket.emit("error-message", { message: "Nessuna partita di Briscola attiva." });
    return;
  }

  if (game.gameOver) {
    socket.emit("error-message", { message: "La partita è già terminata." });
    return;
  }

  if (game.turn !== socket.id) {
    socket.emit("error-message", { message: "Non è il tuo turno." });
    return;
  }

  const cardId = String(payload.cardId || "").trim();
  if (!cardId) return;

  const hand = game.hands[socket.id] || [];
  const cardIndex = hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    socket.emit("error-message", { message: "Carta non valida." });
    return;
  }

  const [playedCard] = hand.splice(cardIndex, 1);
  game.tableCards.push({
    playerId: socket.id,
    card: playedCard,
  });

  const partnerId = getPartnerId(socket.id);

  if (game.tableCards.length === 1 && partnerId) {
    game.turn = partnerId;
    game.status = `${game.usernames[socket.id]} ha giocato ${cardLabel(playedCard)}.`;
    emitBriscolaState(roomId);
    return;
  }

  if (game.tableCards.length === 2) {
    game.status = `${game.usernames[socket.id]} ha giocato ${cardLabel(playedCard)}. Presa assegnata tra 5 secondi.`;
    if (game.pendingTrickTimeout) {
      clearTimeout(game.pendingTrickTimeout);
    }
    game.pendingTrickResolvesAt = Date.now() + BRISCOLA_TRICK_RESOLVE_DELAY_MS;
    emitBriscolaState(roomId);
    game.pendingTrickTimeout = setTimeout(() => {
      const currentGame = briscolaGames.get(roomId);
      if (!currentGame || currentGame.gameOver || currentGame.tableCards.length !== 2) return;

      resolveTrick(currentGame);
      emitBriscolaState(roomId);
    }, BRISCOLA_TRICK_RESOLVE_DELAY_MS);
  }
}

setInterval(() => {
  const now = Date.now();

  briscolaGames.forEach((game, roomId) => {
    if (
      !game.gameOver &&
      game.tableCards.length === 2 &&
      game.pendingTrickResolvesAt !== null &&
      now >= game.pendingTrickResolvesAt
    ) {
      resolveTrick(game);
      emitBriscolaState(roomId);
    }
  });
}, BRISCOLA_TRICK_SWEEP_INTERVAL_MS);

function leaveCurrentChat(socket, options = { notifyPartner: true }) {
  const partnerSocketId = activeChats.get(socket.id);
  if (!partnerSocketId) return;

  const roomId = roomIdFromPair(socket.id, partnerSocketId);

  activeChats.delete(socket.id);
  activeChats.delete(partnerSocketId);

  clearBriscolaRoom(roomId);
  clearColorRoom(roomId);

  const partnerSocket = io.sockets.sockets.get(partnerSocketId);
  if (partnerSocket && options.notifyPartner) {
    partnerSocket.emit("peer-left");
  }
}

function tryMatch(socket) {
  const current = waitingQueue.find((entry) => entry.socketId === socket.id);
  if (!current) return false;

  const currentIndex = waitingQueue.findIndex((entry) => entry.socketId === socket.id);

  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < waitingQueue.length; i += 1) {
    const candidate = waitingQueue[i];
    if (candidate.socketId === socket.id) continue;

    const currentInterests = current.interests || [];
    const candidateInterests = candidate.interests || [];
    const commonCount = currentInterests.filter((interest) => candidateInterests.includes(interest)).length;

    if (commonCount > bestScore) {
      bestScore = commonCount;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    return false;
  }

  const me = waitingQueue[currentIndex];
  const other = waitingQueue[bestIndex];

  if (!me || !other) return false;

  const meSocket = io.sockets.sockets.get(me.socketId);
  const otherSocket = io.sockets.sockets.get(other.socketId);

  if (!meSocket || !otherSocket) {
    removeFromQueue(me.socketId);
    removeFromQueue(other.socketId);
    return false;
  }

  removeFromQueue(me.socketId);
  removeFromQueue(other.socketId);

  activeChats.set(me.socketId, other.socketId);
  activeChats.set(other.socketId, me.socketId);

  initVoteState(roomIdFromPair(me.socketId, other.socketId), me.socketId, other.socketId);
  initColorVoteState(roomIdFromPair(me.socketId, other.socketId), me.socketId, other.socketId);

  meSocket.emit("match-found", {
    stranger: {
      id: other.userId,
      username: other.username,
      interests: other.interests,
    },
  });

  otherSocket.emit("match-found", {
    stranger: {
      id: me.userId,
      username: me.username,
      interests: me.interests,
    },
  });

  return true;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token mancante." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Token non valido." });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.post("/auth/register", async (req, res) => {
  try {
    const rawUsername = req.body?.username;
    const password = String(req.body?.password || "").trim();

    const username = sanitizeUsername(rawUsername);
    const usernameLower = normalizeUsername(username);

    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
      return res.status(400).json({
        message: `L'username deve avere tra ${MIN_USERNAME_LENGTH} e ${MAX_USERNAME_LENGTH} caratteri.`,
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`,
      });
    }

    const existingUser = await User.findOne({ usernameLower });
    if (existingUser) {
      return res.status(409).json({ message: "Username già utilizzato." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      usernameLower,
      passwordHash,
    });

    const token = createToken(user);

    return res.status(201).json({
      user: {
        id: String(user._id),
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Errore interno del server." });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const rawUsername = req.body?.username;
    const password = String(req.body?.password || "").trim();

    const username = sanitizeUsername(rawUsername);
    const usernameLower = normalizeUsername(username);

    const user = await User.findOne({ usernameLower });

    if (!user) {
      return res.status(401).json({ message: "Credenziali non valide." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Credenziali non valide." });
    }

    if (isUserConnected(user._id)) {
      return res.status(409).json({
        message: "Questo account è già connesso da un'altra finestra o dispositivo.",
      });
    }

    const token = createToken(user);

    return res.json({
      user: {
        id: String(user._id),
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Errore interno del server." });
  }
});

app.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Utente non trovato." });
    }

    return res.json({
      user: {
        id: String(user._id),
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return res.status(500).json({ message: "Errore interno del server." });
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Token mancante."));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("Utente non trovato."));
    }

    const sessionId = String(socket.handshake.auth?.sessionId || "").trim();
    const existingEntry = getConnectedUserEntry(user._id);

    if (
      existingEntry?.socketId &&
      io.sockets.sockets.has(existingEntry.socketId) &&
      existingEntry.socketId !== socket.id &&
      existingEntry.sessionId &&
      existingEntry.sessionId !== sessionId
    ) {
      return next(new Error("Questo account è già connesso da un'altra finestra o dispositivo."));
    }

    socket.data.user = {
      id: String(user._id),
      username: user.username,
    };
    socket.data.sessionId = sessionId;

    return next();
  } catch (error) {
    return next(new Error("Token non valido."));
  }
});

io.on("connection", (socket) => {
  const currentUser = socket.data.user;

  console.log("🟢 Connesso:", currentUser.username);

  const previousEntry = getConnectedUserEntry(currentUser.id);
  if (previousEntry?.socketId && previousEntry.socketId !== socket.id) {
    disconnectUser(previousEntry.socketId);
  }

  connectedUsers.set(currentUser.id, {
    socketId: socket.id,
    sessionId: String(socket.data.sessionId || ""),
  });
  onlineUsers.set(socket.id, currentUser);
  emitOnlineCount();

  socket.emit("connected", { user: currentUser });

  socket.on("presence", () => {
    emitOnlineCount();
  });

  socket.on("find-stranger", (payload = {}) => {
    const interests = sanitizeInterests(payload.interests);

    removeFromQueue(socket.id);
    leaveCurrentChat(socket);

    waitingQueue.push({
      socketId: socket.id,
      userId: currentUser.id,
      username: currentUser.username,
      interests,
      queuedAt: Date.now(),
    });

    socket.emit("searching");
    tryMatch(socket);
  });

  socket.on("leave-chat", () => {
    removeFromQueue(socket.id);
    leaveCurrentChat(socket);
  });

  socket.on("chat-message", (payload = {}) => {
    const text = sanitizeMessage(payload.text);
    if (!text) return;

    const partnerSocket = getPartnerSocket(socket.id);
    if (!partnerSocket) {
      socket.emit("error-message", { message: "Nessuna chat attiva." });
      return;
    }

    partnerSocket.emit("chat-message", { text });
  });

  socket.on("typing", () => {
    const now = Date.now();
    const lastTyping = typingCooldowns.get(socket.id) || 0;

    if (now - lastTyping < TYPING_THROTTLE_MS) return;
    typingCooldowns.set(socket.id, now);

    const partnerSocket = getPartnerSocket(socket.id);
    if (partnerSocket) {
      partnerSocket.emit("peer-typing");
    }
  });

  socket.on("stop-typing", () => {
    const partnerSocket = getPartnerSocket(socket.id);
    if (partnerSocket) {
      partnerSocket.emit("peer-stopped-typing");
    }
  });

  socket.on("briscola-vote", (payload = {}) => {
    handleBriscolaVote(socket, payload);
  });

  socket.on("briscola-play-card", (payload = {}) => {
    handleBriscolaPlayCard(socket, payload);
  });

  socket.on("color-vote", (payload = {}) => {
    handleColorVote(socket, payload);
  });

  socket.on("color-submit", (payload = {}) => {
    handleColorSubmit(socket, payload);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnesso:", currentUser.username);

    typingCooldowns.delete(socket.id);
    removeFromQueue(socket.id);
    leaveCurrentChat(socket);
    onlineUsers.delete(socket.id);
    if (getConnectedUserEntry(currentUser.id)?.socketId === socket.id) {
      connectedUsers.delete(currentUser.id);
    }
    emitOnlineCount();
  });
});

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🔥 MongoDB connesso"))
  .catch((err) => console.error("❌ MongoDB errore:", err));

server.listen(PORT, () => {
  console.log(`✅ Backend avviato su http://localhost:${PORT}`);
  console.log(`🌐 Frontend autorizzato: ${CLIENT_URL}`);
});
