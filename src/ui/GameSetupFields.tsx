import type { GameSetup } from "../game";
import { DEAL_DEEDS_OPTIONS, STARTING_CASH_OPTIONS, pesos } from "../game";

export interface GameSetupFieldsProps {
  readonly setup: GameSetup;
  readonly onChange: (setup: GameSetup) => void;
}

/** What the table agrees on before starting: starting cash and deeds dealt out. Shared by the local setup and the online lobby. */
export function GameSetupFields({ setup, onChange }: GameSetupFieldsProps) {
  return (
    <>
      <label className="count">
        Plata inicial
        <div className="count-buttons">
          {STARTING_CASH_OPTIONS.map((option) => (
            <button type="button" key={option} className={setup.startingCash === option ? "active" : ""} onClick={() => onChange({ ...setup, startingCash: option })}>
              {pesos(option)}
            </button>
          ))}
        </div>
        <span className="hint">El reglamento reparte $35.000; con menos de cinco jugadores sugiere repartir más.</span>
      </label>
      <label className="count">
        Escrituras repartidas al empezar
        <div className="count-buttons">
          {DEAL_DEEDS_OPTIONS.map((option) => (
            <button type="button" key={option} className={setup.dealDeeds === option ? "active" : ""} onClick={() => onChange({ ...setup, dealDeeds: option })}>
              {option === 0 ? "Ninguna" : `${option} c/u`}
            </button>
          ))}
        </div>
        <span className="hint">Gratis y al azar, antes de la primera tirada: acorta la partida y hay canjes y construcciones desde el primer turno.</span>
      </label>
    </>
  );
}
