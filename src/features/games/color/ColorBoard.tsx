import { useEffect, useMemo, useState } from "react";
import { Eye, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ColorGameState, ColorValue } from "./types";

const defaultGuess: ColorValue = {
  h: 180,
  s: 50,
  l: 50,
  hex: "#40bfbf",
};

function colorToCss(color: ColorValue | null) {
  if (!color) return "hsl(180 50% 50%)";
  return `hsl(${color.h} ${color.s}% ${color.l}%)`;
}

function VerticalSlider({
  label,
  value,
  min,
  max,
  onChange,
  gradient,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  gradient: string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300">
        {label}
      </span>
      <div className="flex h-[420px] w-20 items-center justify-center rounded-[24px] border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="color-range h-8 w-[404px] -rotate-90 appearance-none rounded-full"
          style={{ background: gradient }}
        />
      </div>
      <span className="text-sm font-medium text-zinc-300">{value}</span>
    </div>
  );
}

export function ColorBoard({
  gameState,
  strangerName,
  onSubmitGuess,
}: {
  gameState: ColorGameState | null;
  strangerName: string;
  onSubmitGuess: (guess: { h: number; s: number; l: number }) => void;
}) {
  const [guess, setGuess] = useState({ h: 180, s: 50, l: 50 });
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.myGuess) {
      setGuess({
        h: gameState.myGuess.h,
        s: gameState.myGuess.s,
        l: gameState.myGuess.l,
      });
    } else {
      setGuess({ h: 180, s: 50, l: 50 });
    }
  }, [gameState?.round, gameState?.myGuess]);

  useEffect(() => {
    const phaseEndsAt = gameState?.phaseEndsAt;
    if (!phaseEndsAt) {
      setRemainingMs(0);
      return;
    }

    const update = () => {
      setRemainingMs(Math.max(0, phaseEndsAt - Date.now()));
    };

    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [gameState?.phaseEndsAt]);

  const previewCss = useMemo(
    () => `hsl(${guess.h} ${guess.s}% ${guess.l}%)`,
    [guess.h, guess.l, guess.s]
  );

  if (!gameState) {
    return (
      <div className="flex h-full min-h-[760px] items-center justify-center rounded-[30px] border border-white/10 bg-black/35 p-8 text-center text-zinc-300">
        Caricamento partita...
      </div>
    );
  }

  const phaseLabel =
    gameState.phase === "memorize"
      ? "Memorizza"
      : gameState.phase === "guess"
      ? "Ricrea il colore"
      : gameState.phase === "result"
      ? "Risultato round"
      : "Partita conclusa";
  const timerSeconds = Math.ceil(remainingMs / 1000);
  const isMemorizePhase = gameState.phase === "memorize";
  const isUrgentTimer = timerSeconds <= 10 && gameState.phase !== "finished" && timerSeconds > 0;

  return (
    <div className="relative h-full min-h-[760px] overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_20%),linear-gradient(180deg,#17171b,#121216)] p-5 shadow-[inset_0_0_30px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-3 rounded-[26px] border border-white/8" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Round</p>
          <p className="mt-1 text-xl font-bold text-white">
            {Math.max(gameState.round, 1)}/{gameState.totalRounds}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-200">
          {phaseLabel}
        </div>

        <div
          className={`rounded-2xl border border-white/10 bg-white/[0.04] text-right ${
            isMemorizePhase ? "px-5 py-4" : "px-4 py-3"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Tempo</p>
          <p
            className={`mt-1 font-bold ${
              isUrgentTimer ? "animate-pulse text-red-400" : "text-white"
            } ${isMemorizePhase ? "text-4xl" : "text-xl"}`}
          >
            {timerSeconds}s
          </p>
        </div>
      </div>

      {isMemorizePhase ? (
        <div
          className="relative z-10 mt-5 min-h-[620px] rounded-[28px] border border-white/10 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
          style={{ background: colorToCss(gameState.targetColor ?? defaultGuess) }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-full border border-black/10 bg-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/60 backdrop-blur">
              {gameState.status}
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-900 shadow-lg">
              <Eye className="mr-2 inline h-3.5 w-3.5" />
              Memoriza
            </div>
          </div>
        </div>
      ) : (
      <div className="relative z-10 mt-5">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex justify-center">
              <VerticalSlider
                label="Hue"
                value={guess.h}
                min={0}
                max={359}
                disabled={gameState.phase !== "guess" || gameState.mySubmitted}
                onChange={(value) => setGuess((prev) => ({ ...prev, h: value }))}
                gradient="linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)"
              />
            </div>

            <div className="flex justify-center">
              <VerticalSlider
                label="Sat"
                value={guess.s}
                min={0}
                max={100}
                disabled={gameState.phase !== "guess" || gameState.mySubmitted}
                onChange={(value) => setGuess((prev) => ({ ...prev, s: value }))}
                gradient={`linear-gradient(90deg,hsl(${guess.h} 0% ${guess.l}%),hsl(${guess.h} 100% ${guess.l}%))`}
              />
            </div>

            <div className="flex justify-center">
              <VerticalSlider
                label="Light"
                value={guess.l}
                min={0}
                max={100}
                disabled={gameState.phase !== "guess" || gameState.mySubmitted}
                onChange={(value) => setGuess((prev) => ({ ...prev, l: value }))}
                gradient={`linear-gradient(90deg,#000000,hsl(${guess.h} ${guess.s}% 50%),#ffffff)`}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <div
            className="relative mt-8 min-h-[260px] w-full rounded-[28px] border border-white/10 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
            style={{
              background:
                gameState.phase === "guess" && !gameState.revealResult
                  ? previewCss
                  : colorToCss(gameState.targetColor ?? gameState.revealResult?.targetColor ?? defaultGuess),
            }}
          >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-full border border-black/10 bg-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/60 backdrop-blur">
                  {gameState.status}
                </div>
              </div>

              {gameState.revealResult ? (
                <div className="absolute bottom-5 left-5 right-5 rounded-[24px] border border-black/10 bg-black/20 p-4 text-sm text-black/75 backdrop-blur">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Target</p>
                      <p className="mt-1 font-semibold">{gameState.revealResult.targetColor.hex}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Tu</p>
                      <p className="mt-1 font-semibold">
                        {gameState.revealResult.myGuess.hex} · {gameState.revealResult.myScore} pt
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{strangerName}</p>
                      <p className="mt-1 font-semibold">
                        {gameState.revealResult.opponentGuess.hex} · {gameState.revealResult.opponentScore} pt
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {gameState.phase === "guess" ? (
                <div className="absolute bottom-5 right-5">
                  <Button
                    onClick={() => onSubmitGuess(guess)}
                    disabled={gameState.mySubmitted}
                  className="rounded-full bg-white px-6 py-7 text-base text-zinc-950 shadow-lg hover:bg-zinc-100"
                >
                    <Palette className="mr-2 h-5 w-5" />
                    {gameState.mySubmitted ? "Inviato" : "Invia colore"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm font-semibold text-white">Punteggio</p>
          <div className="mt-2 space-y-1 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-4">
              <span>Tu</span>
              <span className="font-bold text-white">{gameState.myTotalScore}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>{strangerName}</span>
              <span className="font-bold text-white">{gameState.opponentTotalScore}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
          <p className="font-semibold text-white">Stato avversario</p>
          <p className="mt-2">
            {gameState.opponentSubmitted
              ? `${strangerName} ha già inviato il colore.`
              : `${strangerName} sta ancora scegliendo.`}
          </p>
          {gameState.gameOver ? (
            <p className="mt-2 font-semibold text-emerald-200">
              {gameState.winner === "me"
                ? "Hai vinto."
                : gameState.winner === "opponent"
                ? `Ha vinto ${strangerName}.`
                : "Pareggio."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
