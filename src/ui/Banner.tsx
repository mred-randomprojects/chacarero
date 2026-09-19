import type { GameEvent, GameState } from "../game";

export interface BannerProps {
  readonly state: GameState;
  readonly event: GameEvent | null;
  readonly onSkip: () => void;
}

function playerOf(event: GameEvent): string | null {
  switch (event.type) {
    case "transfer":
      return event.from.type === "player" ? event.from.playerId : event.to.type === "player" ? event.to.playerId : null;
    case "deed":
      return event.to.type === "player" ? event.to.playerId : event.from.type === "player" ? event.from.playerId : null;
    case "building":
    case "mortgage":
      return null;
    default:
      return event.playerId;
  }
}

const ICONS: Readonly<Record<GameEvent["type"], string>> = {
  log: "",
  move: "🚶",
  transfer: "💵",
  deed: "📜",
  building: "🏠",
  mortgage: "🏦",
  card: "🃏",
  jail: "🔒",
  bankrupt: "💥",
  turn: "🎲",
};

/**
 * The one event being replayed right now, big and centre-stage, with a
 * button to hurry it along. One at a time, so the whole table follows.
 */
export function Banner({ state, event, onSkip }: BannerProps) {
  if (!event) return null;
  const playerId = playerOf(event);
  const color = playerId ? (state.players.find((p) => p.id === playerId)?.color ?? "#000") : "#7a5230";
  return (
    <div className={`banner ${event.type}`} key={event.text} onClick={onSkip} role="status">
      <span className="dot" style={{ background: color }} />
      <span className="icon">{ICONS[event.type]}</span>
      <span className="text">{event.text}</span>
      <button type="button" className="skip" onClick={onSkip} title="Continuar (Enter)">
        ▸
      </button>
    </div>
  );
}
