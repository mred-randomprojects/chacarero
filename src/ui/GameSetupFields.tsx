import type { GameSetup } from "../game";
import { DEAL_DEEDS_OPTIONS, DECISION_SECONDS_OPTIONS, ROLL_SECONDS_OPTIONS, STARTING_CASH_OPTIONS, pesos } from "../game";

export interface GameSetupFieldsProps {
  readonly setup: GameSetup;
  readonly onChange: (setup: GameSetup) => void;
}

/** "10 s", "1 min", "3 min". */
function clockLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
}

/** What the table agrees on before starting: starting cash, deeds dealt out and the clocks. Shared by the local setup and the online lobby. */
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
      <label className="count">
        Tiempo por decisión
        <div className="count-buttons">
          {DECISION_SECONDS_OPTIONS.map((option) => (
            <button type="button" key={option} className={setup.decisionSeconds === option ? "active" : ""} onClick={() => onChange({ ...setup, decisionSeconds: option })}>
              {clockLabel(option)}
            </button>
          ))}
        </div>
        <span className="hint">Cuando se acaba, la mesa decide sola (no compra, pasa en el remate, termina el turno). Corto sirve para que nadie espere a quien se fue.</span>
      </label>
      <label className="count">
        Tiempo para tirar los dados
        <div className="count-buttons">
          {ROLL_SECONDS_OPTIONS.map((option) => (
            <button type="button" key={option ?? "same"} className={setup.rollSeconds === option ? "active" : ""} onClick={() => onChange({ ...setup, rollSeconds: option })}>
              {option === null ? "Igual" : clockLabel(option)}
            </button>
          ))}
        </div>
        <span className="hint">Una barra se va llenando mientras tenés los dados; cuando se llena, se tiran solos.</span>
      </label>
    </>
  );
}
