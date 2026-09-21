import type { GameState } from "../game";

export interface TopBarProps {
  readonly state: GameState;
  readonly roomCode: string | null;
  readonly connection: "local" | "connecting" | "open" | "closed";
  readonly onShowList: () => void;
  /** Opens the trade screen; absent when this screen may not propose right now. */
  readonly onTrade: (() => void) | null;
  readonly onSettings: () => void;
  readonly onLeave: () => void;
}

/** Slim strip at the top left: title, table code, turn counter and the global buttons. */
export function TopBar({ state, roomCode, connection, onShowList, onTrade, onSettings, onLeave }: TopBarProps) {
  return (
    <div className="top-bar">
      <h1>Chacarero</h1>
      <span className="top-meta">
        {roomCode && (
          <>
            Mesa <strong>{roomCode}</strong>
            {connection !== "open" && <span className="offline"> · {connection === "connecting" ? "reconectando…" : "sin conexión"}</span>}
            {" · "}
          </>
        )}
        Turno {state.turn}
      </span>
      <div className="top-buttons">
        <button type="button" onClick={onShowList} title="Mapa del tablero y lista de propiedades (L)">
          Mapa
        </button>
        {onTrade && (
          <button type="button" onClick={onTrade} title="Proponer un canje (C)">
            Canjear
          </button>
        )}
        <button type="button" onClick={onSettings} title="Ajustes (,)" aria-label="Ajustes">
          ⚙
        </button>
        <button type="button" onClick={onLeave} title="Dejar la mesa">
          Salir
        </button>
      </div>
    </div>
  );
}
