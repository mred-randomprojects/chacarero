import type { ActionRequest, GameState } from "../game";
import { MIN_BID_INCREMENT, canRaiseCash, currentPlayer, deedName, getDeed, getPlayer, pesos } from "../game";
import type { Dispatch } from "./ActionBar";
import { canAct, waitingFor } from "./perspective";
import { useNow } from "./useNow";

export interface PromptProps {
  readonly state: GameState;
  readonly you: string | null;
  readonly busy: boolean;
  /** Local-clock ms when the table decides by itself, or null when there is no clock. */
  readonly deadline: number | null;
  readonly dispatch: Dispatch;
  readonly onNewGame: () => void;
  /** Opens the properties list so the player can sell or mortgage before deciding. */
  readonly onManage: () => void;
  /** Whether this screen may start a new game (host online, anyone locally). */
  readonly canRestart: boolean;
}

function Countdown({ deadline, now }: { readonly deadline: number | null; readonly now: number }) {
  if (deadline === null) return null;
  const remaining = Math.max(0, (deadline - now) / 1000);
  return (
    <div className="countdown" aria-hidden>
      <div className="countdown-bar" style={{ width: `${Math.min(100, (remaining / 20) * 100)}%` }} />
      <span>{Math.ceil(remaining)}s</span>
    </div>
  );
}

/**
 * Centre-stage card for every decision the game is waiting on. Only the
 * player who must decide gets buttons; everyone else sees who is up. The
 * clock is the session's (server's online), so all screens agree.
 */
export function Prompt({ state, you, busy, deadline, dispatch, onNewGame, onManage, canRestart }: PromptProps) {
  const { phase } = state;
  const player = currentPlayer(state);
  const now = useNow(!busy && deadline !== null);
  if (busy) return null;

  const mine = (action: ActionRequest) => canAct(state, you, action);
  const waiting = (action: ActionRequest) => <p className="waiting-for">{waitingFor(state, action)}</p>;

  switch (phase.type) {
    case "awaitingMove": {
      const dice = state.dice ?? [0, 0];
      const total = dice[0] + dice[1];
      const action: ActionRequest = { type: "movePawn" };
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name} sacó {dice[0]} + {dice[1]} = {total}
          </h3>
          <p>{dice[0] === dice[1] ? "¡Doble! Después de mover, tira otra vez." : "A mover el peón para ver dónde cae."}</p>
          {mine(action) ? (
            <div className="buttons">
              <button type="button" className="primary" onClick={() => dispatch(action)}>
                Mover {total} casilleros
              </button>
            </div>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "awaitingCardAck": {
      const { card } = phase;
      const action: ActionRequest = { type: "acknowledgeCard" };
      return (
        <div className={`prompt ${card.deck}`}>
          <h3>
            <span className="dot" style={{ background: player.color }} /> {card.deck === "suerte" ? "Suerte" : "Destino"}
          </h3>
          <p className="card-text">{card.text}</p>
          {mine(action) ? (
            <div className="buttons">
              <button type="button" className="primary" onClick={() => dispatch(action)}>
                Aplicar
              </button>
            </div>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "awaitingBuyDecision": {
      const deed = getDeed(phase.deedId);
      const action: ActionRequest = { type: "buy" };
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name} cayó en {deedName(deed)}
          </h3>
          <p>
            Está libre: ¿la compra por {pesos(deed.price)}? Si no, sale a remate.
            {mine(action) && player.cash < deed.price ? ` Tenés ${pesos(player.cash)}: podés hipotecar o vender antes.` : ""}
          </p>
          {mine(action) ? (
            <div className="buttons">
              <button type="button" className="primary" disabled={player.cash < deed.price} onClick={() => dispatch(action)}>
                Comprar por {pesos(deed.price)}
              </button>
              <button type="button" onClick={() => dispatch({ type: "decline" })}>
                No comprar
              </button>
              <button type="button" onClick={onManage}>
                Mis propiedades
              </button>
            </div>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "awaitingPayOrDraw": {
      const action: ActionRequest = { type: "choosePay" };
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name}: pagar {pesos(phase.amount)} o levantar una tarjeta
          </h3>
          {mine(action) ? (
            <div className="buttons">
              <button type="button" className="primary" onClick={() => dispatch(action)}>
                Pagar {pesos(phase.amount)}
              </button>
              <button type="button" onClick={() => dispatch({ type: "chooseDraw" })}>
                Levantar {phase.deck === "suerte" ? "Suerte" : "Destino"}
              </button>
            </div>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "awaitingPayment": {
      const debtor = getPlayer(state, phase.debtorId);
      const missing = phase.amount - debtor.cash;
      const to = phase.to.type === "bank" ? "al Banco" : `a ${getPlayer(state, phase.to.playerId).name}`;
      const stuck = !canRaiseCash(state, debtor.id);
      const action: ActionRequest = { type: "settlePayment" };
      return (
        <div className="prompt urgent">
          <h3>
            <span className="dot" style={{ background: debtor.color }} /> {debtor.name} debe {pesos(phase.amount)} {to}
          </h3>
          <p>
            {phase.reason}. {missing > 0 ? `Le faltan ${pesos(missing)}: tiene que vender construcciones o hipotecar.` : "Ya tiene la plata."}
          </p>
          {mine(action) ? (
            <div className="buttons">
              <button type="button" className="primary" disabled={missing > 0} onClick={() => dispatch(action)}>
                Pagar
              </button>
              <button type="button" onClick={onManage}>
                Vender / hipotecar
              </button>
              <button type="button" className="danger" disabled={!stuck || missing <= 0} onClick={() => dispatch({ type: "declareBankruptcy" })}>
                Declarar quiebra
              </button>
            </div>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "auction": {
      const { auction } = phase;
      const deed = getDeed(auction.deedId);
      const bidder = getPlayer(state, auction.turnBidderId);
      const leader = auction.highestBidderId ? getPlayer(state, auction.highestBidderId) : null;
      const min = auction.highestBid + MIN_BID_INCREMENT;
      const steps = [min, auction.highestBid + 500, auction.highestBid + 1_000, auction.highestBid + 2_000];
      const action: ActionRequest = { type: "passBid" };
      return (
        <div className="prompt auction">
          <h3>Remate: {deedName(deed)}</h3>
          <p>
            {leader ? (
              <>
                Oferta más alta <strong>{pesos(auction.highestBid)}</strong> de {leader.name}.
              </>
            ) : (
              "Todavía sin ofertas."
            )}{" "}
            Le toca a <span className="dot" style={{ background: bidder.color }} /> <strong>{bidder.name}</strong> (tiene {pesos(bidder.cash)}).
          </p>
          {mine(action) ? (
            <div className="buttons">
              {steps.map((amount) => (
                <button key={amount} type="button" className={amount === min ? "primary" : ""} disabled={amount > bidder.cash} onClick={() => dispatch({ type: "bid", amount })}>
                  {pesos(amount)}
                </button>
              ))}
              <button type="button" className="danger" onClick={() => dispatch(action)}>
                Pasar
              </button>
            </div>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "turnEnd": {
      const action: ActionRequest = { type: "endTurn" };
      return (
        <div className="prompt quiet">
          <h3>
            <span className="dot" style={{ background: player.color }} /> Termina el turno de {player.name}
          </h3>
          {mine(action) ? (
            <>
              <p>Todavía podés construir, vender o hipotecar desde tus escrituras.</p>
              <div className="buttons">
                <button type="button" className="primary" onClick={() => dispatch(action)}>
                  Terminar turno
                </button>
                <button type="button" onClick={onManage}>
                  Mis propiedades
                </button>
              </div>
            </>
          ) : (
            waiting(action)
          )}
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "gameOver":
      return (
        <div className="prompt">
          <h3>🏆 ¡Ganó {getPlayer(state, phase.winnerId).name}!</h3>
          {canRestart && (
            <div className="buttons">
              <button type="button" className="primary" onClick={onNewGame}>
                {you === null ? "Nueva partida" : "Volver a la sala"}
              </button>
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}
