import type { GameState } from "../game";
import { JAIL_BAIL, currentPlayer, payBail, pesos, useJailCard } from "../game";

/** Applies an engine action and returns the new state, or null if it was refused. */
export type Act = (action: (state: GameState) => GameState) => GameState | null;

export interface ActionBarProps {
  readonly state: GameState;
  readonly busy: boolean;
  readonly shaking: boolean;
  readonly canRoll: boolean;
  readonly onShakeStart: () => void;
  readonly onShakeEnd: () => void;
  readonly act: Act;
}

interface DiceButtonProps {
  readonly label: string;
  readonly shaking: boolean;
  readonly disabled: boolean;
  readonly onShakeStart: () => void;
  readonly onShakeEnd: () => void;
}

/** Hold to shake the dice, release to throw. A quick tap throws too. */
function DiceButton({ label, shaking, disabled, onShakeStart, onShakeEnd }: DiceButtonProps) {
  return (
    <button
      type="button"
      className={`primary dice-button${shaking ? " shaking" : ""}`}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onShakeStart();
      }}
      onPointerUp={onShakeEnd}
      onPointerCancel={onShakeEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      {shaking ? "🎲 ¡Soltá para tirar!" : `🎲 ${label}`}
    </button>
  );
}

function Dice({ dice }: { readonly dice: readonly [number, number] | null }) {
  if (!dice) return null;
  return (
    <span className="dice" aria-label={`Dados: ${dice[0]} y ${dice[1]}`}>
      <span className="die">{dice[0]}</span>
      <span className="die">{dice[1]}</span>
      {dice[0] === dice[1] && <span className="double">¡Doble!</span>}
    </span>
  );
}

/** Bottom-left bar: whose turn, the last dice, and the dice button (plus jail options). */
export function ActionBar({ state, busy, shaking, canRoll, onShakeStart, onShakeEnd, act }: ActionBarProps) {
  const player = currentPlayer(state);
  const { phase } = state;
  const rolling = phase.type === "awaitingRoll" || phase.type === "awaitingJailDecision";

  return (
    <div className="actions">
      <div className="who">
        <span className="dot" style={{ background: player.color }} />
        <strong>{player.name}</strong>
        {player.inJail && <span className="status">preso</span>}
        <Dice dice={state.dice} />
      </div>
      {state.lastCard && (
        <div className={`card ${state.lastCard.deck}`}>
          <span className="card-title">{state.lastCard.deck === "suerte" ? "Suerte" : "Destino"}</span>
          {state.lastCard.text}
        </div>
      )}
      {rolling && (
        <div className="buttons">
          {busy && !shaking ? (
            <span className="waiting">Mirá la mesa…</span>
          ) : (
            <>
              <DiceButton
                label={phase.type === "awaitingJailDecision" ? "Tirar (doble para salir)" : "Tirar los dados"}
                shaking={shaking}
                disabled={!canRoll && !shaking}
                onShakeStart={onShakeStart}
                onShakeEnd={onShakeEnd}
              />
              {phase.type === "awaitingJailDecision" && (
                <>
                  <button type="button" disabled={player.cash < JAIL_BAIL} onClick={() => act(payBail)}>
                    Pagar fianza {pesos(JAIL_BAIL)}
                  </button>
                  {player.getOutOfJailCards > 0 && (
                    <button type="button" onClick={() => act(useJailCard)}>
                      Usar tarjeta
                    </button>
                  )}
                </>
              )}
              <span className="hint">Mantené apretado para mezclar (o la barra espaciadora)</span>
            </>
          )}
        </div>
      )}
      {!rolling && phase.type !== "gameOver" && <span className="waiting">{busy ? "Mirá la mesa…" : "Esperando decisión…"}</span>}
    </div>
  );
}
