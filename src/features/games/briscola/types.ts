export type Suit = "coppe" | "denar" | "spade" | "basto";

export type BriscolaCard = {
  id: string;
  suit: Suit;
  value: number;
};

export type TableCard = {
  player: "me" | "opponent";
  card: BriscolaCard;
};

export type VoteMode = "idle" | "start" | "end";

export type BriscolaVoteState = {
  mode: VoteMode;
  myVote: boolean;
  peerVote: boolean;
};

export type BriscolaGameState = {
  myHand: BriscolaCard[];
  opponentHandCount: number;
  tableCards: TableCard[];
  myPoints: number;
  opponentPoints: number;
  deckCount: number;
  briscolaCard: BriscolaCard | null;
  briscolaAvailable: boolean;
  amITurn: boolean;
  status: string;
  gameOver: boolean;
  winner: "me" | "opponent" | "draw" | null;
};
