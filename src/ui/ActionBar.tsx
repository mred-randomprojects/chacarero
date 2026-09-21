import type { ActionRequest, Card, GameState, Player } from "../game";
import { JAIL_BAIL, currentPlayer, pesos } from "../game";
import { Key } from "./Key";
import { canAct } from "./perspective";
import { TokenIcon } from "./TokenIcon";

export type Dispatch = (action: ActionRequest) => void;

export interface ActionBarProps {
  readonly state: GameState;
  /** The player the table shows on turn (lags the real one during a replay). */
  readonly shownPlayer: Player;
  /** The Suerte/Destino card face up on the table, from the view, so it shows here the moment it shows there. */
  readonly cardOnTable: Card | null;
  readonly you: string | null;
  readonly busy: boolean;
  readonly shaking: boolean;
  readonly canRoll: boolean;
  readonly onShakeStart: () => void;
  readonly onShakeEnd: () => void;
  /** Opens the trade dialog; absent when this screen may not propose right now. */
  readonly onTrade: (() => void) | null;
  readonly dispatch: Dispatch;
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
      {shaking ? "🎲 ¡Soltá para tirar!" : <>🎲 {label} <Key k=" " /></>}
    </button>
  );
}

/** The last throw; "¡Doble!" only while the extra turn it earned is still pending (never during the opening throws). */
function Dice({ dice, rollAgain }: { readonly dice: readonly [number, number] | null; readonly rollAgain: boolean }) {
  if (!dice) return null;
  return (
    <span className="dice" aria-label={`Dados: ${dice[0]} y ${dice[1]}`}>
      <span className="die">{dice[0]}</span>
      <span className="die">{dice[1]}</span>
      {rollAgain && <span className="double">¡Doble!</span>}
    </span>
  );
}

/** Bottom-left bar: whose turn, the last dice, and the dice button (plus jail options). */
export function ActionBar({ state, shownPlayer, cardOnTable, you, busy, shaking, canRoll, onShakeStart, onShakeEnd, onTrade, dispatch }: ActionBarProps) {
  // The buttons act on the real state; the name and the dice shown follow the table.
  const player = busy ? shownPlayer : currentPlayer(state);
  const { phase } = state;
  const rolling = phase.type === "openingRoll" || phase.type === "awaitingRoll" || phase.type === "awaitingJailDecision";
  const mine = canAct(state, you, { type: "rollDice" });

  return (
    <div className="actions">
      <div className="who">
        <TokenIcon token={player.token} size={20} />
        <strong>{player.name}</strong>
        {player.inJail && <span className="status">preso</span>}
        <Dice dice={state.dice} rollAgain={state.rollAgain} />
      </div>
      {cardOnTable && (
        <div className={`card ${cardOnTable.deck}`}>
          <span className="card-title">{cardOnTable.deck === "suerte" ? "Suerte" : "Destino"}</span>
          {cardOnTable.text}
        </div>
      )}
      {rolling && (
        <div className="buttons">
          {busy && !shaking ? (
            <span className="waiting">Mirá la mesa…</span>
          ) : !mine ? (
            <span className="waiting">{player.name} tiene los dados…</span>
          ) : (
            <>
              <DiceButton
                label={phase.type === "awaitingJailDecision" ? "Tirar (doble para salir)" : phase.type === "openingRoll" ? "Tirar para ver quién empieza" : "Tirar los dados"}
                shaking={shaking}
                disabled={!canRoll && !shaking}
                onShakeStart={onShakeStart}
                onShakeEnd={onShakeEnd}
              />
              {phase.type === "awaitingJailDecision" && (
                <>
                  <button type="button" disabled={busy || player.cash < JAIL_BAIL} onClick={() => dispatch({ type: "payBail" })}>
                    Pagar fianza {pesos(JAIL_BAIL)} <Key k="p" />
                  </button>
                  {player.getOutOfJailCards > 0 && (
                    <button type="button" disabled={busy} onClick={() => dispatch({ type: "spendJailCard" })}>
                      Usar tarjeta <Key k="u" />
                    </button>
                  )}
                </>
              )}
              {onTrade && (
                <button type="button" disabled={busy} onClick={onTrade} title="Proponer un canje (N)">
                  ⇄ Negociar <Key k="n" />
                </button>
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
