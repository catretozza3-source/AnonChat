export type Topic =
  | "musica"
  | "gaming"
  | "film"
  | "tech"
  | "anime"
  | "calcio"
  | "meme";

export type AuthUser = {
  id: string;
  username: string;
  token: string;
};

export type PeerUser = {
  id: string;
  username: string;
  interests: string[];
};

export type ChatMessage = {
  id: number;
  text: string;
  time: string;
  system?: boolean;
  fromMe?: boolean;
};

export type AuthResponse = {
  user: {
    id: string;
    username: string;
  };
  token: string;
};
