import cardBackImage from "@/assets/carte/napoli/retro.png";
import { getCardImage, getCardLabel } from "./card-utils";
import type { BriscolaCard, BriscolaGameState } from "./types";

function CardBack({ small = false }: { small?: boolean }) {
  const classes = small
    ? "h-[86px] w-[58px] sm:h-[122px] sm:w-[82px]"
    : "h-[108px] w-[74px] sm:h-[156px] sm:w-[108px]";
  return (
    <img
      src={cardBackImage}
      alt="Retro carta"
      draggable={false}
      className={`${classes} rounded-xl object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)] select-none`}
    />
  );
}

function NapoliCardImage({
  card,
  size = "normal",
  onClick,
  playable = false,
}: {
  card: BriscolaCard;
  size?: "small" | "normal" | "large";
  onClick?: () => void;
  playable?: boolean;
}) {
  const classes =
    size === "small"
      ? "h-[86px] w-[58px] sm:h-[122px] sm:w-[82px]"
      : size === "large"
      ? "h-[118px] w-[82px] sm:h-[176px] sm:w-[122px]"
      : "h-[108px] w-[74px] sm:h-[156px] sm:w-[108px]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={getCardLabel(card)}
      className={`${playable ? "hover:-translate-y-3 cursor-pointer" : "cursor-default"} transition`}
    >
      <img
        src={getCardImage(card)}
        alt={getCardLabel(card)}
        draggable={false}
        className={`${classes} rounded-xl object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)] select-none`}
      />
    </button>
  );
}

export function BriscolaBoard({
  gameState,
  strangerName,
  onPlayCard,
}: {
  gameState: BriscolaGameState | null;
  strangerName: string;
  onPlayCard: (cardId: string) => void;
}) {
  if (!gameState) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-[30px] border border-white/10 bg-black/35 p-8 text-center text-zinc-300 sm:min-h-[760px]">
        Caricamento partita...
      </div>
    );
  }

  const briscolaLabel = gameState.briscolaCard ? getCardLabel(gameState.briscolaCard) : "Nessuna";

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.16),transparent_28%),linear-gradient(180deg,#14532d,#166534)] p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.28)] sm:min-h-[760px] sm:p-4">
      <div className="absolute inset-3 rounded-[26px] border border-white/10" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-3 sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl">
            <p className="text-xs font-semibold text-white">Turno attuale</p>
            <p className="mt-1 text-xs text-zinc-300">
              {gameState.gameOver
                ? "Partita terminata"
                : gameState.amITurn
                ? "Tocca a te"
                : `Tocca a ${strangerName}`}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl">
            <p className="text-xs font-semibold text-white">Briscola</p>
            <p className="mt-1 text-xs text-zinc-300">{briscolaLabel}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/15 p-3 backdrop-blur-xl">
          <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
            {strangerName}
          </div>
          <div className="flex justify-center gap-2">
            {Array.from({ length: gameState.opponentHandCount }).map((_, index) => (
              <CardBack key={index} small />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3 rounded-[24px] border border-white/10 bg-black/15 p-3 backdrop-blur-xl">
          <div className="flex min-h-[132px] items-center justify-center gap-3">
            {gameState.tableCards.length > 0 ? (
              gameState.tableCards.map((played, index) => (
                <div
                  key={`${played.player}-${played.card.id}`}
                  className={index === 0 ? "rotate-[-4deg]" : "rotate-[4deg]"}
                >
                  <NapoliCardImage card={played.card} size="large" />
                </div>
              ))
            ) : (
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-300">
                Tavolo vuoto
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-center backdrop-blur-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                Mazzo
              </p>
              <p className="mt-1 text-xl font-black text-white">{gameState.deckCount}</p>
            </div>

            {gameState.deckCount > 0 ? <CardBack small /> : null}

            {gameState.briscolaAvailable && gameState.briscolaCard ? (
              <div className="rotate-90">
                <NapoliCardImage card={gameState.briscolaCard} size="small" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/15 p-3 backdrop-blur-xl">
          <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
            Le tue carte
          </div>
          <div className="flex justify-center gap-3">
            {gameState.myHand.map((card) => (
              <NapoliCardImage
                key={card.id}
                card={card}
                size="large"
                playable={gameState.amITurn && !gameState.gameOver}
                onClick={() => {
                  if (gameState.amITurn && !gameState.gameOver) {
                    onPlayCard(card.id);
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Punteggio</p>
            <div className="mt-2 space-y-1 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-5">
                <span>Tu</span>
                <span className="font-bold text-white">{gameState.myPoints}</span>
              </div>
              <div className="flex items-center justify-between gap-5">
                <span>{strangerName}</span>
                <span className="font-bold text-white">{gameState.opponentPoints}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Stato</p>
            <p className="mt-1 text-sm text-zinc-300">{gameState.status}</p>
            {gameState.gameOver ? (
              <p className="mt-2 text-sm font-semibold text-emerald-200">
                {gameState.winner === "me"
                  ? "Hai vinto."
                  : gameState.winner === "opponent"
                  ? "Ha vinto l'avversario."
                  : "Pareggio."}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-4 z-10 hidden rounded-2xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl sm:left-5 sm:top-5 sm:block sm:px-4 sm:py-3">
        <p className="text-sm font-semibold text-white">Turno attuale</p>
        <p className="mt-1 text-sm text-zinc-300">
          {gameState.gameOver
            ? "Partita terminata"
            : gameState.amITurn
            ? "Tocca a te"
            : `Tocca a ${strangerName}`}
        </p>
      </div>

      <div className="absolute right-4 top-4 z-10 hidden rounded-2xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl sm:right-5 sm:top-5 sm:block sm:px-4 sm:py-3">
        <p className="text-sm font-semibold text-white">Briscola</p>
        <p className="mt-1 max-w-[190px] text-sm text-zinc-300">{briscolaLabel}</p>
      </div>

      <div className="absolute left-1/2 top-20 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 sm:top-7 sm:flex">
        <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-xl">
          {strangerName}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {Array.from({ length: gameState.opponentHandCount }).map((_, index) => (
            <CardBack key={index} small />
          ))}
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-4 sm:flex sm:gap-7">
        {gameState.tableCards.map((played, index) => (
          <div
            key={`${played.player}-${played.card.id}`}
            className={index === 0 ? "rotate-[-4deg]" : "rotate-[4deg]"}
          >
            <NapoliCardImage card={played.card} size="large" />
          </div>
        ))}
      </div>

      <div className="absolute bottom-32 left-1/2 z-10 hidden w-[min(280px,82vw)] -translate-x-1/2 items-end justify-center gap-3 sm:bottom-28 sm:flex sm:w-[406px] sm:gap-5">
        {gameState.myHand.map((card) => (
          <NapoliCardImage
            key={card.id}
            card={card}
            size="large"
            playable={gameState.amITurn && !gameState.gameOver}
            onClick={() => {
              if (gameState.amITurn && !gameState.gameOver) {
                onPlayCard(card.id);
              }
            }}
          />
        ))}
      </div>

      <div className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-2 sm:right-6 sm:flex sm:gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">Mazzo</p>
          <p className="mt-1 text-2xl font-black text-white">{gameState.deckCount}</p>
        </div>

        <div className="relative h-[86px] w-[58px] sm:h-[118px] sm:w-[78px]">
          {gameState.deckCount > 0 ? (
            <>
              <div className="absolute left-0 top-0">
                <CardBack small />
              </div>
              <div className="absolute left-[-4px] top-[-4px]">
                <CardBack small />
              </div>
              <div className="absolute left-[-8px] top-[-8px]">
                <CardBack small />
              </div>
            </>
          ) : null}
        </div>

        {gameState.briscolaAvailable && gameState.briscolaCard ? (
          <div className="rotate-90">
            <NapoliCardImage card={gameState.briscolaCard} size="small" />
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-6 left-6 right-6 z-10 hidden gap-3 sm:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
          <p className="text-sm font-semibold text-white">Punteggio</p>
          <div className="mt-2 space-y-1 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-5">
              <span>Tu</span>
              <span className="font-bold text-white">{gameState.myPoints}</span>
            </div>
            <div className="flex items-center justify-between gap-5">
              <span>{strangerName}</span>
              <span className="font-bold text-white">{gameState.opponentPoints}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
          <p className="text-sm font-semibold text-white">Stato</p>
          <p className="mt-1 text-sm text-zinc-300">{gameState.status}</p>
          {gameState.gameOver ? (
            <p className="mt-2 text-sm font-semibold text-emerald-200">
              {gameState.winner === "me"
                ? "Hai vinto."
                : gameState.winner === "opponent"
                ? "Ha vinto l'avversario."
                : "Pareggio."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
