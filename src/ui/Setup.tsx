import { useState } from "react";
import type { NewPlayer } from "../game";
import { MAX_PLAYERS, MIN_PLAYERS, STARTING_CASH, pesos } from "../game";

export const PLAYER_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"] as const;

export interface SetupProps {
  readonly onStart: (players: readonly NewPlayer[], startingCash: number) => void;
  readonly onBack: () => void;
}

/** The rulebook says $35.000 and "with fewer than five players it pays to hand out more". */
const CASH_OPTIONS = [STARTING_CASH, 50_000, 70_000] as const;

/** Pre-game screen: how many play and what they are called. */
export function Setup({ onStart, onBack }: SetupProps) {
  const [names, setNames] = useState<string[]>(["", ""]);
  const [cash, setCash] = useState<number>(STARTING_CASH);

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
        <label className="count">
          Plata inicial
          <div className="count-buttons">
            {CASH_OPTIONS.map((option) => (
              <button type="button" key={option} className={cash === option ? "active" : ""} onClick={() => setCash(option)}>
                {pesos(option)}
              </button>
            ))}
          </div>
          <span className="hint">El reglamento reparte $35.000; con menos de cinco jugadores sugiere repartir más.</span>
        </label>
        <button type="button" className="primary" onClick={() => onStart(players, cash)}>
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
