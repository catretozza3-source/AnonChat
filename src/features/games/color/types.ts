export type VoteMode = "idle" | "start" | "end";

export type ColorVoteState = {
  mode: VoteMode;
  myVote: boolean;
  peerVote: boolean;
};

export type ColorValue = {
  h: number;
  s: number;
  l: number;
  hex: string;
};

export type ColorRoundReveal = {
  targetColor: ColorValue;
  myGuess: ColorValue;
  opponentGuess: ColorValue;
  myScore: number;
  opponentScore: number;
};

export type ColorGamePhase = "memorize" | "guess" | "result" | "finished";

export type ColorGameState = {
  round: number;
  totalRounds: number;
  phase: ColorGamePhase;
  phaseEndsAt: number | null;
  status: string;
  targetColor: ColorValue | null;
  myGuess: ColorValue | null;
  opponentSubmitted: boolean;
  mySubmitted: boolean;
  myRoundScore: number | null;
  opponentRoundScore: number | null;
  myTotalScore: number;
  opponentTotalScore: number;
  revealResult: ColorRoundReveal | null;
  gameOver: boolean;
  winner: "me" | "opponent" | "draw" | null;
};
