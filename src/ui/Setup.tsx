import { useState } from "react";
import type { GameSetup, NewPlayer } from "../game";
import { DEFAULT_SETUP, MAX_PLAYERS, MIN_PLAYERS } from "../game";
import { GameSetupFields } from "./GameSetupFields";

export const PLAYER_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"] as const;

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
  const [setup, setSetup] = useState<GameSetup>(DEFAULT_SETUP);

  const setCount = (count: number) => {
    setNames((current) => Array.from({ length: count }, (_, i) => current[i] ?? ""));
  };

  const players: NewPlayer[] = names.map((name, i) => ({
    id: `p${i + 1}`,
    name: name.trim() || `Jugador ${i + 1}`,
    color: PLAYER_COLORS[i] ?? "#000000",
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
            <li key={player.id}>
              <span className="dot" style={{ background: player.color }} />
              <input
                type="text"
                value={names[i] ?? ""}
                placeholder={`Jugador ${i + 1}`}
                maxLength={16}
                onChange={(event) => setNames((current) => current.map((n, j) => (j === i ? event.target.value : n)))}
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
