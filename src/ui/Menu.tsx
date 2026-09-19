import { useState } from "react";

export interface MenuProps {
  readonly savedName: string;
  /** Room code from an invite link, if any. */
  readonly inviteCode: string | null;
  /** Null when this build has no room server to talk to. */
  readonly onlineAvailable: boolean;
  readonly connection: "connecting" | "open" | "closed";
  readonly notFound: string | null;
  readonly onCreate: (name: string) => void;
  readonly onJoin: (name: string, code: string) => void;
  readonly onLocal: () => void;
}

/** First screen: play online (create or join a table) or at a shared screen. */
export function Menu({ savedName, inviteCode, onlineAvailable, connection, notFound, onCreate, onJoin, onLocal }: MenuProps) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(inviteCode ?? "");
  const ready = name.trim().length > 0 && connection === "open";

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Chacarero</h1>
        <p className="tagline">El juego de campo argentino. Comprá provincias, poblalas de chacras y fundí a los demás.</p>
        {onlineAvailable ? (
          <>
            <label className="count">
              Tu nombre
              <input type="text" value={name} placeholder="Como te dicen en el campo" maxLength={16} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <div className="menu-row">
              <button type="button" className="primary" disabled={!ready} onClick={() => onCreate(name.trim())}>
                Armar una mesa
              </button>
            </div>
            <label className="count">
              Entrar a una mesa
              <div className="menu-row">
                <input
                  type="text"
                  value={code}
                  placeholder="Código"
                  maxLength={4}
                  className="code-input"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && ready && code.length === 4 && onJoin(name.trim(), code)}
                />
                <button type="button" disabled={!ready || code.trim().length !== 4} onClick={() => onJoin(name.trim(), code.trim())}>
                  Entrar
                </button>
              </div>
            </label>
            {notFound && <p className="error">No existe la mesa {notFound}.</p>}
            {connection !== "open" && <p className="hint">{connection === "connecting" ? "Conectando con el servidor…" : "Sin conexión con el servidor; reintentando."}</p>}
          </>
        ) : (
          <p className="hint">Esta versión no tiene servidor de mesas; se puede jugar en una sola pantalla.</p>
        )}
        <button type="button" className={onlineAvailable ? "link" : "primary"} onClick={onLocal}>
          Jugar en esta pantalla (modo mesa)
        </button>
      </div>
    </div>
  );
}
