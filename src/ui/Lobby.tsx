import { useState } from "react";
import type { RoomView } from "../net/protocol";
import { inviteLink } from "../net/identity";
import { STARTING_CASH, pesos } from "../game";

const CASH_OPTIONS = [STARTING_CASH, 50_000, 70_000] as const;

export interface LobbyProps {
  readonly room: RoomView;
  readonly you: string;
  readonly connection: "connecting" | "open" | "closed";
  readonly onStart: (startingCash: number) => void;
  readonly onRename: (name: string) => void;
  readonly onLeave: () => void;
}

/** Waiting room: who is here, the invite link, and the host's start button. */
export function Lobby({ room, you, connection, onStart, onRename, onLeave }: LobbyProps) {
  const me = room.players.find((p) => p.playerId === you);
  const isHost = room.hostId === you;
  const [name, setName] = useState(me?.name ?? "");
  const [cash, setCash] = useState<number>(STARTING_CASH);
  const [copied, setCopied] = useState(false);
  const link = inviteLink(room.code);

  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });
  };

  return (
    <div className="setup">
      <div className="setup-card lobby">
        <h1>Chacarero</h1>
        <p className="tagline">
          Mesa <strong className="code">{room.code}</strong>
          {connection !== "open" && <span className="offline"> · {connection === "connecting" ? "reconectando…" : "sin conexión"}</span>}
        </p>
        <div className="invite">
          <input type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={copy}>
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
        <ol className="names">
          {room.players.map((player) => (
            <li key={player.playerId} className={player.connected ? "" : "away"}>
              <span className="dot" style={{ background: player.color }} />
              {player.playerId === you ? (
                <input
                  type="text"
                  value={name}
                  maxLength={16}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() && name.trim() !== me?.name && onRename(name.trim())}
                />
              ) : (
                <span className="lobby-name">{player.name}</span>
              )}
              {player.playerId === room.hostId && <span className="host">anfitrión</span>}
              {!player.connected && <span className="offline">ausente</span>}
            </li>
          ))}
        </ol>
        {isHost ? (
          <>
            <label className="count">
              Plata inicial
              <div className="count-buttons">
                {CASH_OPTIONS.map((option) => (
                  <button type="button" key={option} className={cash === option ? "active" : ""} onClick={() => setCash(option)}>
                    {pesos(option)}
                  </button>
                ))}
              </div>
            </label>
            <button type="button" className="primary" disabled={room.players.length < 2 || connection !== "open"} onClick={() => onStart(cash)}>
              {room.players.length < 2 ? "Esperando a alguien más…" : `Empezar con ${room.players.length} jugadores`}
            </button>
          </>
        ) : (
          <p className="hint">Esperando a que {room.players.find((p) => p.playerId === room.hostId)?.name ?? "el anfitrión"} empiece la partida.</p>
        )}
        <button type="button" className="link" onClick={onLeave}>
          Salir de la mesa
        </button>
      </div>
    </div>
  );
}
