import type { GameState } from "../game";
import { currentPlayer, pesos } from "../game";

export interface PlayersPanelProps {
  readonly state: GameState;
  readonly cash: Readonly<Record<string, number>>;
  readonly you: string | null;
  readonly offline: ReadonlySet<string>;
  readonly roomCode: string | null;
  readonly connection: "local" | "connecting" | "open" | "closed";
  readonly onShowList: () => void;
  /** Opens the trade dialog; absent when this screen may not propose right now. */
  readonly onTrade: (() => void) | null;
  readonly onLeave: () => void;
}

/** Top-left list of players with cash and status; the current one is highlighted, you are marked. */
export function PlayersPanel({ state, cash, you, offline, roomCode, connection, onShowList, onTrade, onLeave }: PlayersPanelProps) {
  const current = currentPlayer(state);
  return (
    <div className="players">
      <h1>Chacarero</h1>
      {roomCode && (
        <p className="room-code">
          Mesa <strong>{roomCode}</strong>
          {connection !== "open" && <span className="offline"> · {connection === "connecting" ? "reconectando…" : "sin conexión"}</span>}
        </p>
      )}
      <ul>
        {state.players.map((player) => (
          <li key={player.id} className={`${player.id === current.id ? "current" : ""} ${player.bankrupt ? "bankrupt" : ""} ${offline.has(player.id) ? "away" : ""}`}>
            <span className="dot" style={{ background: player.color }} />
            <span className="name">
              {player.name}
              {player.id === you ? " (vos)" : ""}
            </span>
            <span className="status">
              {player.bankrupt ? "quebró" : player.inJail ? "preso" : offline.has(player.id) ? "ausente" : ""}
              {player.getOutOfJailCards > 0 && !player.bankrupt ? ` 🎫${player.getOutOfJailCards}` : ""}
            </span>
            <span className="cash">{player.bankrupt ? "—" : pesos(cash[player.id] ?? player.cash)}</span>
          </li>
        ))}
      </ul>
      <div className="players-footer">
        <span className="turn">Turno {state.turn}</span>
        <button type="button" onClick={onShowList} title="Lista de propiedades (L)">
          Propiedades
        </button>
        {onTrade && (
          <button type="button" onClick={onTrade} title="Proponer un canje (C)">
            Canjear
          </button>
        )}
        <button type="button" onClick={onLeave} title="Dejar la mesa">
          Salir
        </button>
      </div>
    </div>
  );
}
