import type { GameState } from "../game";
import {
  JAIL_BAIL,
  buy,
  canRaiseCash,
  chooseDraw,
  choosePay,
  currentPlayer,
  declareBankruptcy,
  decline,
  deedName,
  endTurn,
  getDeed,
  getPlayer,
  payBail,
  pesos,
  roll,
  settlePayment,
  useJailCard,
} from "../game";

export type Act = (action: (state: GameState) => GameState) => void;

export interface ActionBarProps {
  readonly state: GameState;
  readonly busy: boolean;
  readonly act: Act;
  readonly onNewGame: () => void;
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

/** Bottom bar: whose turn it is and the buttons the current phase allows. */
export function ActionBar({ state, busy, act, onNewGame }: ActionBarProps) {
  const player = currentPlayer(state);
  const { phase } = state;

  const buttons = (() => {
    if (busy) return <span className="waiting">Moviendo…</span>;
    switch (phase.type) {
      case "awaitingRoll":
        return (
          <button type="button" className="primary" onClick={() => act((s) => roll(s))}>
            Tirar los dados
          </button>
        );
      case "awaitingJailDecision":
        return (
          <>
            <button type="button" className="primary" onClick={() => act((s) => roll(s))}>
              Tirar (doble para salir)
            </button>
            <button type="button" disabled={player.cash < JAIL_BAIL} onClick={() => act(payBail)}>
              Pagar fianza {pesos(JAIL_BAIL)}
            </button>
            {player.getOutOfJailCards > 0 && (
              <button type="button" onClick={() => act(useJailCard)}>
                Usar tarjeta
              </button>
            )}
          </>
        );
      case "awaitingBuyDecision": {
        const deed = getDeed(phase.deedId);
        return (
          <>
            <button type="button" className="primary" disabled={player.cash < deed.price} onClick={() => act(buy)}>
              Comprar {deedName(deed)} por {pesos(deed.price)}
            </button>
            <button type="button" onClick={() => act(decline)}>
              No comprar
            </button>
          </>
        );
      }
      case "awaitingPayOrDraw":
        return (
          <>
            <button type="button" className="primary" onClick={() => act(choosePay)}>
              Pagar {pesos(phase.amount)}
            </button>
            <button type="button" onClick={() => act(chooseDraw)}>
              Levantar {phase.deck === "suerte" ? "Suerte" : "Destino"}
            </button>
          </>
        );
      case "awaitingPayment": {
        const missing = phase.amount - player.cash;
        const to = phase.to.type === "bank" ? "al Banco" : `a ${getPlayer(state, phase.to.playerId).name}`;
        const stuck = !canRaiseCash(state, player.id);
        return (
          <>
            <span className="debt">
              Debés {pesos(phase.amount)} {to}
              {missing > 0 ? ` — te faltan ${pesos(missing)}. Vendé o hipotecá desde el panel de cada propiedad.` : "."}
            </span>
            <button type="button" className="primary" disabled={missing > 0} onClick={() => act(settlePayment)}>
              Pagar
            </button>
            <button type="button" className="danger" disabled={!stuck || missing <= 0} onClick={() => act(declareBankruptcy)}>
              Declarar quiebra
            </button>
          </>
        );
      }
      case "turnEnd":
        return (
          <button type="button" className="primary" onClick={() => act(endTurn)}>
            Terminar turno
          </button>
        );
      case "gameOver":
        return (
          <>
            <span className="winner">🏆 ¡Ganó {getPlayer(state, phase.winnerId).name}!</span>
            <button type="button" className="primary" onClick={onNewGame}>
              Nueva partida
            </button>
          </>
        );
    }
  })();

  return (
    <div className="actions">
      <div className="who">
        <span className="dot" style={{ background: player.color }} />
        <strong>{player.name}</strong>
        <Dice dice={state.dice} />
      </div>
      {state.lastCard && (
        <div className={`card ${state.lastCard.deck}`}>
          <span className="card-title">{state.lastCard.deck === "suerte" ? "Suerte" : "Destino"}</span>
          {state.lastCard.text}
        </div>
      )}
      <div className="buttons">{buttons}</div>
    </div>
  );
}
