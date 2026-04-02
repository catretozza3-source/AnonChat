import type { BriscolaCard, Suit } from "./types";

export function getCardImage(card: BriscolaCard) {
  const value = String(card.value).padStart(2, "0");
  return new URL(`../../../assets/carte/napoli/${value}_${card.suit}.png`, import.meta.url).href;
}

export function getCardLabel(card: BriscolaCard) {
  const names: Record<number, string> = {
    1: "Asso",
    8: "Fante",
    9: "Cavallo",
    10: "Re",
  };

  const suitNames: Record<Suit, string> = {
    coppe: "Coppe",
    denar: "Denari",
    spade: "Spade",
    basto: "Bastoni",
  };

  return `${names[card.value] ?? card.value} di ${suitNames[card.suit]}`;
}
