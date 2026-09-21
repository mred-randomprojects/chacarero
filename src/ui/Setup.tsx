import { useState } from "react";
import type { GameSetup, NewPlayer, TokenId } from "../game";
import { DEFAULT_SETUP, MAX_PLAYERS, MIN_PLAYERS, TOKEN_IDS } from "../game";
import { GameSetupFields } from "./GameSetupFields";
import { TokenIcon, TokenPicker } from "./TokenIcon";

export interface SetupProps {
  readonly onStart: (players: readonly NewPlayer[], setup: GameSetup) => void;
  readonly onBack: () => void;
  /** Whether decisions have no clock at this table (the countdown setting at 0). */
  readonly noClock: boolean;
  readonly onNoClock: (noClock: boolean) => void;
}

/** Pre-game screen for the shared table: how many play, what they are called, and how the game starts. */
export function Setup({ onStart, onBack, noClock, onNoClock }: SetupProps) {
  const [names, setNames] = useState<string[]>(["", ""]);
  // Seat i starts with token i; picking one another seat holds swaps the two.
  const [tokens, setTokens] = useState<TokenId[]>(() => TOKEN_IDS.slice(0, 2));
  const [setup, setSetup] = useState<GameSetup>(DEFAULT_SETUP);

  const setCount = (count: number) => {
    setNames((current) => Array.from({ length: count }, (_, i) => current[i] ?? ""));
    setTokens((current) => {
      const next: TokenId[] = current.slice(0, count);
      while (next.length < count) next.push(TOKEN_IDS.find((t) => !next.includes(t)) ?? "tractor");
      return next;
    });
  };

  const pickToken = (seat: number, token: TokenId) => {
    setTokens((current) => current.map((t, i) => (i === seat ? token : t)));
  };

  const players: NewPlayer[] = names.map((name, i) => ({
    id: `p${i + 1}`,
    name: name.trim() || `Jugador ${i + 1}`,
    token: tokens[i] ?? "tractor",
  }));

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Chacarero</h1>
        <p className="tagline">El juego de campo argentino. Comprá provincias, poblalas de chacras y fundí a los demás.</p>
        <label className="count">
          Jugadores
          <div className="count-buttons">
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
              <button type="button" key={n} className={names.length === n ? "active" : ""} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </label>
        <ol className="names">
          {players.map((player, i) => (
            <li key={player.id} className="seat">
              <div className="seat-name">
                <TokenIcon token={player.token} size={28} />
                <input
                  type="text"
                  value={names[i] ?? ""}
                  placeholder={`Jugador ${i + 1}`}
                  maxLength={16}
                  onChange={(event) => setNames((current) => current.map((n, j) => (j === i ? event.target.value : n)))}
                />
              </div>
              <TokenPicker
                value={player.token}
                taken={new Map(players.filter((p) => p.id !== player.id).map((p) => [p.token, p.name]))}
                onChange={(token) => pickToken(i, token)}
              />
            </li>
          ))}
        </ol>
        <GameSetupFields setup={setup} onChange={setSetup} />
        <label className="check">
          <input type="checkbox" checked={noClock} onChange={(e) => onNoClock(e.target.checked)} /> Sin tiempo para decidir (nadie apura a nadie; ideal para probar)
        </label>
        <button type="button" className="primary" onClick={() => onStart(players, setup)}>
          Empezar
        </button>
        <p className="hint">Modo mesa: todos juegan en esta pantalla, por turnos.</p>
        <button type="button" className="link" onClick={onBack}>
          Volver
        </button>
      </div>
    </div>
  );
}
