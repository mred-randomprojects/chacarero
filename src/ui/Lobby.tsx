import { useState } from "react";
import type { GameSetup, TokenId } from "../game";
import { DEFAULT_SETUP } from "../game";
import type { RoomView } from "../net/protocol";
import { inviteLink } from "../net/identity";
import { GameSetupFields } from "./GameSetupFields";
import { TokenIcon, TokenPicker } from "./TokenIcon";

export interface LobbyProps {
  readonly room: RoomView;
  readonly you: string;
  readonly connection: "connecting" | "open" | "closed";
  readonly onStart: (setup: GameSetup) => void;
  readonly onRename: (name: string) => void;
  readonly onChooseToken: (token: TokenId) => void;
  readonly onLeave: () => void;
}

/** Dev only: a second seat at this table from the same browser, in a new tab (see README). */
function openExtraSeat(code: string): void {
  const seat = Math.random().toString(36).slice(2, 8);
  window.open(`${location.pathname}?mesa=${code}&jugador=${seat}`, "_blank");
}

/** Waiting room: who is here, the invite link, and the host's start button. */
export function Lobby({ room, you, connection, onStart, onRename, onChooseToken, onLeave }: LobbyProps) {
  const me = room.players.find((p) => p.playerId === you);
  const isHost = room.hostId === you;
  const [name, setName] = useState(me?.name ?? "");
  const [setup, setSetup] = useState<GameSetup>(DEFAULT_SETUP);
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
            <li key={player.playerId} className={`seat${player.connected ? "" : " away"}`}>
              <div className="seat-name">
                <TokenIcon token={player.token} size={28} />
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
              </div>
              {player.playerId === you && (
                <TokenPicker
                  value={player.token}
                  taken={new Map(room.players.filter((p) => p.playerId !== you).map((p) => [p.token, p.name]))}
                  onChange={onChooseToken}
                  disabled={connection !== "open"}
                />
              )}
            </li>
          ))}
        </ol>
        {import.meta.env.DEV && (
          <button type="button" className="link" onClick={() => openExtraSeat(room.code)}>
            Abrir otra pestaña como otro jugador (dev)
          </button>
        )}
        {isHost ? (
          <>
            <GameSetupFields setup={setup} onChange={setSetup} />
            <button type="button" className="primary" disabled={room.players.length < 2 || connection !== "open"} onClick={() => onStart(setup)}>
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
