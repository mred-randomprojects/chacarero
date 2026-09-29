import { useRef, useState } from "react";
import { Logo } from "./Logo";

export interface MenuProps {
  readonly savedName: string;
  /** Room code from an invite link, if any. */
  readonly inviteCode: string | null;
  /** Null when this build has no room server to talk to. */
  readonly onlineAvailable: boolean;
  readonly connection: "connecting" | "open" | "closed";
  readonly notFound: string | null;
  /** Why the server refused the last create or join (the table started, is full…). */
  readonly error: string | null;
  readonly onCreate: (name: string) => void;
  readonly onJoin: (name: string, code: string) => void;
  readonly onLocal: () => void;
}

/** First screen: play online (create or join a table) or at a shared screen. */
export function Menu({ savedName, inviteCode, onlineAvailable, connection, notFound, error, onCreate, onJoin, onLocal }: MenuProps) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(inviteCode ?? "");
  // Set when a button was pressed without a name: the hint turns into an error and shakes.
  const [nudged, setNudged] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const hasName = name.trim().length > 0;
  const connected = connection === "open";
  const codeReady = code.trim().length === 4;

  // Without a name nothing online can happen, so the buttons stay pressable and say so
  // (a greyed-out button that does nothing reads as a bug).
  const needName = (): boolean => {
    if (hasName) return false;
    setNudged((n) => n + 1);
    nameInput.current?.focus();
    return true;
  };
  const create = () => {
    if (!needName()) onCreate(name.trim());
  };
  const join = () => {
    if (!needName() && codeReady) onJoin(name.trim(), code.trim());
  };

  return (
    <div className="setup">
      <div className="setup-card">
        <h1 className="logo-title">
          <Logo width={400} />
        </h1>
        <p className="tagline">El juego de campo argentino. Comprá provincias, poblalas de chacras y fundí a los demás.</p>
        {onlineAvailable ? (
          <>
            {inviteCode && (
              <p className="invited">
                Te invitaron a la mesa <strong className="code">{inviteCode}</strong>. {hasName ? "Tocá Entrar para sentarte." : "Escribí tu nombre y tocá Entrar."}
              </p>
            )}
            <label className={`count name-field${hasName ? "" : " missing"}`}>
              Tu nombre
              <input
                ref={nameInput}
                type="text"
                value={name}
                placeholder="Como te dicen en el campo"
                maxLength={16}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inviteCode && connected && join()}
                autoFocus
              />
              {!hasName && (
                <span key={nudged} className={`name-required${nudged > 0 ? " nudged" : ""}`}>
                  Para armar una mesa o entrar a una, primero poné tu nombre.
                </span>
              )}
            </label>
            <div className="menu-row">
              {/* Invited, joining is the thing to do; making a table of your own is the side door. */}
              <button type="button" className={inviteCode ? "create" : "create primary"} disabled={!connected} onClick={create}>
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
                  onKeyDown={(e) => e.key === "Enter" && connected && codeReady && join()}
                />
                <button type="button" className={inviteCode ? "primary" : ""} disabled={!connected || !codeReady} onClick={join}>
                  Entrar
                </button>
              </div>
            </label>
            {notFound && <p className="error">No existe la mesa {notFound}: las mesas se cierran tras media hora sin nadie.</p>}
            {error && <p className="error">{error}</p>}
            {!connected && <p className="hint">{connection === "connecting" ? "Conectando con el servidor…" : "Sin conexión con el servidor; reintentando."}</p>}
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
