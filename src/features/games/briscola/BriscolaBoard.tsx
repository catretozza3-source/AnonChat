import { getCardImage, getCardLabel } from "./card-utils";
import type { BriscolaCard, BriscolaGameState } from "./types";

function CardBack({ small = false }: { small?: boolean }) {
  const classes = small ? "h-[122px] w-[82px]" : "h-[156px] w-[108px]";
  return (
    <div
      className={`${classes} rounded-xl border border-white/15 bg-[linear-gradient(135deg,#1d4ed8,#1e3a8a)] shadow-[0_12px_18px_rgba(0,0,0,0.35)]`}
    >
      <div className="m-2 h-[calc(100%-1rem)] rounded-lg border border-white/25 bg-[radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:8px_8px]" />
    </div>
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
      ? "h-[122px] w-[82px]"
      : size === "large"
      ? "h-[176px] w-[122px]"
      : "h-[156px] w-[108px]";

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
      <div className="flex h-full min-h-[760px] items-center justify-center rounded-[30px] border border-white/10 bg-black/35 p-8 text-center text-zinc-300">
        Caricamento partita...
      </div>
    );
  }

  const briscolaLabel = gameState.briscolaCard ? getCardLabel(gameState.briscolaCard) : "Nessuna";

  return (
    <div className="relative h-full min-h-[760px] overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.16),transparent_28%),linear-gradient(180deg,#14532d,#166534)] p-4 shadow-[inset_0_0_30px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-3 rounded-[26px] border border-white/10" />

      <div className="absolute left-5 top-5 z-10 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
        <p className="text-sm font-semibold text-white">Turno attuale</p>
        <p className="mt-1 text-sm text-zinc-300">
          {gameState.gameOver
            ? "Partita terminata"
            : gameState.amITurn
            ? "Tocca a te"
            : `Tocca a ${strangerName}`}
        </p>
      </div>

      <div className="absolute right-5 top-5 z-10 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
        <p className="text-sm font-semibold text-white">Briscola</p>
        <p className="mt-1 max-w-[190px] text-sm text-zinc-300">{briscolaLabel}</p>
      </div>

      <div className="absolute left-1/2 top-7 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-xl">
          {strangerName}
        </div>
        <div className="flex items-center gap-3">
          {Array.from({ length: gameState.opponentHandCount }).map((_, index) => (
            <CardBack key={index} small />
          ))}
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-7">
        {gameState.tableCards.map((played, index) => (
          <div
            key={`${played.player}-${played.card.id}`}
            className={index === 0 ? "rotate-[-4deg]" : "rotate-[4deg]"}
          >
            <NapoliCardImage card={played.card} size="large" />
          </div>
        ))}
      </div>

      <div className="absolute bottom-28 left-1/2 z-10 flex w-[406px] -translate-x-1/2 items-end justify-center gap-5">
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

      <div className="absolute right-6 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">Mazzo</p>
          <p className="mt-1 text-2xl font-black text-white">{gameState.deckCount}</p>
        </div>

        <div className="relative h-[118px] w-[78px]">
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

      <div className="absolute bottom-6 left-6 right-6 z-10 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
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
