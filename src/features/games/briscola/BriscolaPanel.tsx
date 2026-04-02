import { useState } from "react";
import { ChevronDown, Crown, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { BriscolaVoteState } from "./types";

export function BriscolaPanel({
  connected,
  isBriscolaActive,
  voteCount,
  votes,
  hasMyStartVote,
  hasMyEndVote,
  onToggleVote,
}: {
  connected: boolean;
  isBriscolaActive: boolean;
  voteCount: number;
  votes: BriscolaVoteState;
  hasMyStartVote: boolean;
  hasMyEndVote: boolean;
  onToggleVote: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const voteInProgress =
    (votes.mode === "start" && !isBriscolaActive) || (votes.mode === "end" && isBriscolaActive);
  const miniGameSurface = isBriscolaActive
    ? "border-zinc-300/18 bg-[linear-gradient(145deg,rgba(88,88,94,0.9),rgba(58,58,62,0.82)_40%,rgba(30,30,34,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.24)]"
    : "border-stone-200/20 bg-[linear-gradient(145deg,rgba(248,247,244,0.98),rgba(228,226,220,0.92)_38%,rgba(205,201,194,0.9)_62%,rgba(238,236,232,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_42px_rgba(0,0,0,0.2)]";
  const badgeSurface = isBriscolaActive
    ? "border-zinc-200/12 bg-[linear-gradient(135deg,rgba(167,167,172,0.18),rgba(70,70,74,0.3))] text-zinc-100"
    : "border-stone-700/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(230,226,218,0.92))] text-stone-800";
  const counterSurface = isBriscolaActive
    ? "border-zinc-100/12 bg-black/15 text-zinc-100"
    : "border-stone-700/12 bg-white/45 text-stone-700";
  const headingTone = isBriscolaActive ? "text-white" : "text-stone-900";
  const subheadingTone = isBriscolaActive ? "text-zinc-200" : "text-stone-600";
  const ctaActive = isBriscolaActive || hasMyStartVote || hasMyEndVote;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className={`flex w-full items-center justify-between rounded-[24px] border px-5 py-4 text-left backdrop-blur-xl transition hover:scale-[1.01] hover:brightness-105 ${miniGameSurface}`}
      >
        <span className={`text-base font-bold uppercase tracking-[0.2em] ${headingTone}`}>
          Briscola
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
        <div className={`rounded-[28px] border p-4 backdrop-blur-xl ${miniGameSurface}`}>
          <div className="mb-4">
            <div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeSurface}`}
              >
                <Crown className="h-3.5 w-3.5" />
                Mini game
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className={subheadingTone}>Stato attuale</span>
              <span className="font-semibold text-white">
                {isBriscolaActive ? "Partita in corso" : "In attesa"}
              </span>
            </div>

            {connected ? (
              <div className="mt-3">
                <div
                  className={`rounded-[24px] border px-5 py-6 ${
                    votes.myVote
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-zinc-200"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Il tuo voto
                  </p>
                  <p className="mt-3 text-2xl font-semibold leading-none">
                    {votes.myVote ? "Hai votato" : "Non hai votato"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
              {!connected ? (
                <>
                  Connettiti a uno sconosciuto per proporre la{" "}
                  <span className="font-semibold text-white">Briscola</span>.
                </>
              ) : isBriscolaActive ? (
                hasMyEndVote ? (
                  <>
                    Hai avviato la richiesta per <span className="font-semibold text-white">terminare</span> la partita. Serve il consenso di entrambi.
                  </>
                ) : (
                  "La Briscola è attiva. Se volete chiuderla, entrambi dovete premere 'Termina gioco'."
                )
              ) : hasMyStartVote ? (
                <>
                  Hai votato per <span className="font-semibold text-white">iniziare</span>. Quando anche l'altro utente voterà, la partita partirà automaticamente.
                </>
              ) : (
                "Premi il pulsante per proporre la Briscola all'altro utente."
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
            {isBriscolaActive ? (
              <>
                <X className="mr-2 h-4 w-4" />
                {hasMyEndVote ? "Rimuovi voto termina gioco" : "Termina gioco"}
              </>
            ) : (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                {hasMyStartVote ? "Rimuovi voto Briscola" : "Briscola"}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
