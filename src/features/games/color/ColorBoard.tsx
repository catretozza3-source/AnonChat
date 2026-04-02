import { useEffect, useMemo, useRef, useState } from "react";
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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const setValueFromPointer = (clientY: number) => {
    const track = trackRef.current;
    if (!track || disabled) return;

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
    const nextValue = Math.round(min + ratio * (max - min));
    onChange(nextValue);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      event.preventDefault();
      setValueFromPointer(event.clientY);
    };

    const stopDragging = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [disabled, max, min, onChange]);

  const thumbPosition = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300">
        {label}
      </span>
      <div className="flex h-[clamp(120px,22dvh,320px)] w-14 items-center justify-center rounded-[24px] border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:w-20">
        <div
          ref={trackRef}
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onPointerDown={(event) => {
            if (disabled) return;
            isDraggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            setValueFromPointer(event.clientY);
          }}
          className={`relative h-[calc(100%-24px)] w-8 rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.25)] touch-none ${
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          }`}
          style={{ background: gradient }}
        >
          <div
            className="absolute left-1/2 h-6 w-6 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/90 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.28)]"
            style={{ bottom: thumbPosition }}
          />
        </div>
      </div>
      <span className="text-sm font-medium text-zinc-300">{value}</span>
    </div>
  );
}

function ResultSwatch({
  title,
  color,
  scoreLabel,
}: {
  title: string;
  color: ColorValue;
  scoreLabel?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
        {title}
      </p>
      <div
        className="mt-2 h-[clamp(54px,8dvh,88px)] rounded-[20px] border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
        style={{ background: colorToCss(color) }}
      />
      <p className="mt-2 text-center text-sm font-semibold uppercase tracking-[0.16em] text-white">
        {color.hex}
      </p>
      {scoreLabel ? (
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
          {scoreLabel}
        </p>
      ) : null}
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
  const [displayScores, setDisplayScores] = useState({ me: 0, opponent: 0 });
  const scoreAnimationRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!gameState) {
      setDisplayScores({ me: 0, opponent: 0 });
      return;
    }

    if (scoreAnimationRef.current !== null) {
      window.clearInterval(scoreAnimationRef.current);
      scoreAnimationRef.current = null;
    }

    const revealResult = gameState.revealResult;
    const shouldAnimateScore =
      !!revealResult && (gameState.phase === "result" || gameState.phase === "finished");

    if (!shouldAnimateScore) {
      setDisplayScores({
        me: gameState.myTotalScore,
        opponent: gameState.opponentTotalScore,
      });
      return;
    }

    const startMe = 0;
    const startOpponent = 0;
    const endMe = revealResult.myScore;
    const endOpponent = revealResult.opponentScore;
    const startedAt = Date.now();
    const durationMs = 1800;

    setDisplayScores({ me: startMe, opponent: startOpponent });

    scoreAnimationRef.current = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);

      setDisplayScores({
        me: Math.round(startMe + (endMe - startMe) * progress),
        opponent: Math.round(
          startOpponent + (endOpponent - startOpponent) * progress
        ),
      });

      if (progress >= 1 && scoreAnimationRef.current !== null) {
        window.clearInterval(scoreAnimationRef.current);
        scoreAnimationRef.current = null;
      }
    }, 16);

    return () => {
      if (scoreAnimationRef.current !== null) {
        window.clearInterval(scoreAnimationRef.current);
        scoreAnimationRef.current = null;
      }
    };
  }, [gameState]);

  const previewCss = useMemo(
    () => `hsl(${guess.h} ${guess.s}% ${guess.l}%)`,
    [guess.h, guess.l, guess.s]
  );

  if (!gameState) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-[30px] border border-white/10 bg-black/35 p-8 text-center text-zinc-300">
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
  const isFinishedPhase = gameState.phase === "finished";
  const isResultPhase = !!gameState.revealResult && gameState.phase === "result";
  const isUrgentTimer = timerSeconds <= 10 && gameState.phase !== "finished" && timerSeconds > 0;
  const winnerLabel =
    gameState.winner === "me"
      ? "Hai vinto"
      : gameState.winner === "opponent"
      ? `Ha vinto ${strangerName}`
      : "Pareggio";

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_20%),linear-gradient(180deg,#17171b,#121216)] p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-white/8" />

      <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2 sm:px-4 sm:py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Round</p>
          <p className="mt-1 text-xl font-bold text-white">
            {Math.max(gameState.round, 1)}/{gameState.totalRounds}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-200 sm:px-4 sm:text-xs sm:tracking-[0.22em]">
          {phaseLabel}
        </div>

        {!isResultPhase ? (
          <div
            className={`rounded-2xl border border-white/10 bg-white/[0.04] text-right ${
              isMemorizePhase ? "px-3 py-2 sm:px-5 sm:py-4" : "px-3 py-2 sm:px-4 sm:py-3"
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
        ) : (
          <div className="w-[62px] sm:w-[88px]" />
        )}
      </div>

      {isFinishedPhase ? (
        <div className="relative z-10 mt-5 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            Partita finita
          </p>
          <h2 className="mt-4 text-3xl font-black uppercase tracking-[0.12em] text-white sm:text-4xl sm:tracking-[0.16em]">
            {winnerLabel}
          </h2>
          <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-4">
            <div className="rounded-[26px] border border-white/10 bg-black/20 px-4 py-5 sm:px-5 sm:py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Tu
              </p>
              <p className="mt-3 text-4xl font-black text-white sm:text-5xl">{gameState.myTotalScore}</p>
            </div>
            <div className="rounded-[26px] border border-white/10 bg-black/20 px-4 py-5 sm:px-5 sm:py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                {strangerName}
              </p>
              <p className="mt-3 text-4xl font-black text-white sm:text-5xl">
                {gameState.opponentTotalScore}
              </p>
            </div>
          </div>
        </div>
      ) : isMemorizePhase ? (
        <div
          className="relative z-10 mt-5 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.28)] sm:p-6"
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
      ) : isResultPhase && gameState.revealResult ? (
        <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          <div className="grid gap-2">
            <ResultSwatch
              title="Il tuo colore"
              color={gameState.revealResult.myGuess}
              scoreLabel={`+${gameState.revealResult.myScore} pt`}
            />
            <ResultSwatch
              title="Colore target"
              color={gameState.revealResult.targetColor}
            />
            <ResultSwatch
              title={`Colore ${strangerName}`}
              color={gameState.revealResult.opponentGuess}
              scoreLabel={`+${gameState.revealResult.opponentScore} pt`}
            />
          </div>
        </div>
      ) : (
      <div className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
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
            className="relative mt-4 min-h-[clamp(120px,16dvh,220px)] w-full rounded-[28px] border border-white/10 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.28)] sm:p-6"
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
                <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5">
                  <Button
                    onClick={() => onSubmitGuess(guess)}
                    disabled={gameState.mySubmitted}
                  className="rounded-full bg-white px-5 py-6 text-sm text-zinc-950 shadow-lg hover:bg-zinc-100 sm:px-6 sm:py-7 sm:text-base"
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

      {!isFinishedPhase ? (
      <div className="relative z-10 mt-3 grid shrink-0 gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm font-semibold text-white">Punteggio</p>
          <div className="mt-2 space-y-1 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-4">
              <span>Tu</span>
              <span className="font-bold text-white">{displayScores.me}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>{strangerName}</span>
              <span className="font-bold text-white">{displayScores.opponent}</span>
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
      ) : null}
    </div>
  );
}
