import type { Square } from "../game";

export interface HudProps {
  readonly dice: readonly [number, number] | null;
  readonly rolling: boolean;
  readonly landed: Square | null;
  readonly onRoll: () => void;
}

/** Top-left overlay: title, dice button and the last landing square. */
export function Hud({ dice, rolling, landed, onRoll }: HudProps) {
  return (
    <div className="hud">
      <h1>Chacarero</h1>
      <p className="tagline">El juego de campo argentino, en 3D. Arrastrá para girar el tablero.</p>
      <div className="dice-row">
        <button type="button" onClick={onRoll} disabled={rolling}>
          {rolling ? "Moviendo…" : "Tirar los dados"}
        </button>
        {dice && (
          <span className="dice" aria-label={`Dados: ${dice[0]} y ${dice[1]}`}>
            <span className="die">{dice[0]}</span>
            <span className="die">{dice[1]}</span>
            {dice[0] === dice[1] && <span className="double">¡Doble!</span>}
          </span>
        )}
      </div>
      {landed && (
        <p className="landed">
          Cayó en <strong>{landed.name}</strong>
        </p>
      )}
    </div>
  );
}
