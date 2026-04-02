import { useState } from "react";
import { ChevronDown, Palette, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ColorVoteState } from "./types";

export function ColorPanel({
  connected,
  isColorActive,
  voteCount,
  votes,
  hasMyStartVote,
  hasMyEndVote,
  onToggleVote,
}: {
  connected: boolean;
  isColorActive: boolean;
  voteCount: number;
  votes: ColorVoteState;
  hasMyStartVote: boolean;
  hasMyEndVote: boolean;
  onToggleVote: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const voteInProgress =
    (votes.mode === "start" && !isColorActive) || (votes.mode === "end" && isColorActive);
  const headingTone = isColorActive ? "text-white" : "text-stone-900";
  const panelSurface = isColorActive
    ? "border-zinc-300/18 bg-[linear-gradient(145deg,rgba(68,78,105,0.92),rgba(45,49,70,0.86)_40%,rgba(25,26,35,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.24)]"
    : "border-stone-200/20 bg-[linear-gradient(145deg,rgba(248,247,244,0.98),rgba(228,226,220,0.92)_38%,rgba(205,201,194,0.9)_62%,rgba(238,236,232,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_42px_rgba(0,0,0,0.2)]";
  const badgeSurface = isColorActive
    ? "border-zinc-200/12 bg-[linear-gradient(135deg,rgba(163,172,199,0.2),rgba(70,78,104,0.34))] text-zinc-100"
    : "border-stone-700/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(230,226,218,0.92))] text-stone-800";
  const counterSurface = isColorActive
    ? "border-zinc-100/12 bg-black/15 text-zinc-100"
    : "border-stone-700/12 bg-white/45 text-stone-700";
  const ctaActive = isColorActive || hasMyStartVote || hasMyEndVote;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className={`flex w-full items-center justify-between rounded-[24px] border px-5 py-4 text-left transition hover:scale-[1.01] hover:brightness-105 ${panelSurface}`}
      >
        <span className={`text-base font-bold uppercase tracking-[0.2em] ${headingTone}`}>
          Color
        </span>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              voteInProgress
                ? "border-emerald-400/25 bg-emerald-500/14 text-emerald-100"
                : counterSurface
            }`}
          >
            {voteCount}/2
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${headingTone} ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isExpanded ? (
        <div className={`rounded-[28px] border p-4 ${panelSurface}`}>
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeSurface}`}>
            <Palette className="h-3.5 w-3.5" />
            Mini game
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-3">
              <span>Stato attuale</span>
              <span className="font-semibold text-white">
                {isColorActive ? "Partita in corso" : "In attesa"}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              {!connected ? (
                <>
                  Connettiti a uno sconosciuto per proporre{" "}
                  <span className="font-semibold text-white">Color</span>.
                </>
              ) : isColorActive ? (
                hasMyEndVote ? (
                  <>
                    Hai avviato la richiesta per <span className="font-semibold text-white">terminare</span> Color. Serve il consenso di entrambi.
                  </>
                ) : (
                  "Color è attivo. Se volete chiuderlo, entrambi dovete premere 'Termina gioco'."
                )
              ) : hasMyStartVote ? (
                <>
                  Hai votato per <span className="font-semibold text-white">iniziare</span>. Quando anche l'altro utente voterà, Color partirà automaticamente.
                </>
              ) : (
                "Memorizzate un colore per 5 secondi, poi avete 60 secondi per ricrearlo e fare più punti possibile."
              )}
            </div>
          </div>

          <Button
            onClick={onToggleVote}
            disabled={!connected}
            className={`h-12 w-full rounded-2xl ${
              ctaActive
                ? "bg-gradient-to-r from-red-400 to-red-500 text-white hover:from-red-500 hover:to-red-700"
                : "bg-gradient-to-r from-white to-zinc-300 text-black hover:from-emerald-300 hover:to-emerald-500 hover:text-white"
            } shadow-lg focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none`}
          >
            {isColorActive ? (
              <>
                <X className="mr-2 h-4 w-4" />
                {hasMyEndVote ? "Rimuovi voto termina gioco" : "Termina gioco"}
              </>
            ) : (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                {hasMyStartVote ? "Rimuovi voto Color" : "Color"}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
