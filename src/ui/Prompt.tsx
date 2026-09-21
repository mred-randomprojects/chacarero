import type { CSSProperties } from "react";
import type { ActionRequest, GameState } from "../game";
import { MIN_BID_INCREMENT, canRaiseCash, checkTrade, currentPlayer, deedName, getDeed, getPlayer, pesos } from "../game";
import type { Dispatch } from "./ActionBar";
import { DeedDetails } from "./DeedDetails";
import { bandColor } from "../scene/cardTextures";
import { canAct, tradeProposer, waitingFor } from "./perspective";
import { OfferItems } from "./TradeDialog";
import { useNow } from "./useNow";
import { TokenIcon } from "./TokenIcon";

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
  /** Opens the trade dialog to propose a deal. */
  readonly onTrade: () => void;
  /** Opens the trade dialog to answer the pending proposal with a different one. */
  readonly onCounter: () => void;
  /** Whether this screen may start a new game (host online, anyone locally). */
  readonly canRestart: boolean;
}

/** The clock only shows itself for the last minute; before that nobody should feel hurried. */
const COUNTDOWN_SHOWN_SECONDS = 60;

function Countdown({ deadline, now }: { readonly deadline: number | null; readonly now: number }) {
  if (deadline === null) return null;
  const remaining = Math.max(0, (deadline - now) / 1000);
  if (remaining > COUNTDOWN_SHOWN_SECONDS) return null;
  return (
    <div className={`countdown${remaining <= 20 ? " urgent" : ""}`} aria-hidden>
      <div className="countdown-bar" style={{ width: `${Math.min(100, (remaining / COUNTDOWN_SHOWN_SECONDS) * 100)}%` }} />
      <span>{Math.ceil(remaining)}s</span>
    </div>
  );
}

/**
 * Centre-stage card for every decision the game is waiting on. Only the
 * player who must decide gets buttons; everyone else sees who is up. The
 * clock is the session's (server's online), so all screens agree.
 */
export function Prompt(props: PromptProps) {
  const { busy, deadline } = props;
  const now = useNow(!busy && deadline !== null);
  if (busy) return null;
  return (
    // A mouse click must not leave focus on a button, or Space would press it again instead of the highlighted action.
    <div className="prompt-slot" onClick={(event) => event.detail > 0 && event.target instanceof HTMLButtonElement && event.target.blur()}>
      <PromptCard {...props} now={now} />
    </div>
  );
}

function PromptCard({ state, you, deadline, dispatch, onNewGame, onManage, onTrade, onCounter, canRestart, now }: PromptProps & { readonly now: number }) {
  const { phase } = state;
  const player = currentPlayer(state);

  const mine = (action: ActionRequest) => canAct(state, you, action);
  const waiting = (action: ActionRequest) => <p className="waiting-for">{waitingFor(state, action)}</p>;
  const canTrade = tradeProposer(state, you) !== null;

  switch (phase.type) {
    case "openingRoll": {
      const rolled = Object.keys(phase.rolls).length;
      return (
        <div className="prompt opening">
          <h3>¿Quién empieza?</h3>
          <p>{rolled === 0 && phase.contenders.length === state.players.length ? "Cada uno tira una vez: el más alto empieza." : phase.contenders.length < state.players.length ? "Desempate: tiran de nuevo solo los empatados." : "El más alto empieza; si empatan, tiran de nuevo."}</p>
          <ul className="opening-rolls">
            {state.players.map((p) => {
              const roll = phase.rolls[p.id];
              const out = !phase.contenders.includes(p.id);
              const up = p.id === player.id;
              return (
                <li key={p.id} className={`${up ? "up" : ""} ${out ? "out" : ""}`}>
                  <TokenIcon token={p.token} size={22} />
                  <span className="name">{p.name}</span>
                  <span className="roll">{roll !== undefined ? roll : up ? (mine({ type: "rollDice" }) ? "tirá los dados" : "tirando…") : out ? "afuera" : "—"}</span>
                </li>
              );
            })}
          </ul>
          <Countdown deadline={deadline} now={now} />
        </div>
      );
    }
    case "awaitingMove": {
      const dice = state.dice ?? [0, 0];
      const total = dice[0] + dice[1];
      const action: ActionRequest = { type: "movePawn" };
      return (
        <div className="prompt">
          <h3>
            <TokenIcon token={player.token} size={20} /> {player.name} sacó {dice[0]} + {dice[1]} = {total}
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
    case "awaitingDraw": {
      const action: ActionRequest = { type: "drawCard" };
      const suerte = phase.deck === "suerte";
      return (
        <div className={`prompt ${phase.deck}`}>
          <h3>
            <TokenIcon token={player.token} size={20} /> {player.name} cayó en {suerte ? "Suerte" : "Destino"}
          </h3>
          <p>{suerte ? "Hay que levantar la primera tarjeta del mazo de Suerte." : "Hay que levantar la primera tarjeta del mazo de Destino."}</p>
          {mine(action) ? (
            <div className="buttons">
              <button type="button" className="primary" onClick={() => dispatch(action)}>
                Levantar la tarjeta
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
            <TokenIcon token={player.token} size={20} /> {card.deck === "suerte" ? "Suerte" : "Destino"}
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
      const kind = deed.kind === "campo" ? "Este campo" : deed.kind === "ferrocarril" ? "Este ferrocarril" : "Esta compañía";
      return (
        <div className="prompt deed-offer" style={{ "--band": bandColor(deed) } as CSSProperties}>
          <div className="deed-offer-band" />
          <div className="deed-offer-main">
            <h3>
              <TokenIcon token={player.token} size={20} /> {player.name} cayó en {deedName(deed)}
            </h3>
            <p className="deed-offer-price">
              {kind} está libre. Valor <strong>{pesos(deed.price)}</strong>
            </p>
            <p>
              {mine(action)
                ? player.cash < deed.price
                  ? `Tenés ${pesos(player.cash)}: podés hipotecar o vender antes, o mandarla a remate.`
                  : "¿La comprás, o sale a remate para toda la mesa?"
                : "Si no la compra, sale a remate para toda la mesa."}
            </p>
            {mine(action) ? (
              <div className="buttons">
                <button type="button" className="primary" disabled={player.cash < deed.price} onClick={() => dispatch(action)}>
                  Comprar por {pesos(deed.price)}
                </button>
                <button type="button" className="danger" onClick={() => dispatch({ type: "decline" })}>
                  Mandar a remate
                </button>
                <button type="button" onClick={onManage}>
                  Mis propiedades
                </button>
                {canTrade && (
                  <button type="button" onClick={onTrade}>
                    Canjear
                  </button>
                )}
              </div>
            ) : (
              waiting(action)
            )}
            <Countdown deadline={deadline} now={now} />
          </div>
          <div className="deed-offer-details">
            <h4>Lo que dice la escritura</h4>
            <DeedDetails deed={deed} />
          </div>
        </div>
      );
    }
    case "awaitingPayOrDraw": {
      const action: ActionRequest = { type: "choosePay" };
      return (
        <div className="prompt">
          <h3>
            <TokenIcon token={player.token} size={20} /> {player.name}: pagar {pesos(phase.amount)} o levantar una tarjeta
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
            <TokenIcon token={debtor.token} size={20} /> {debtor.name} debe {pesos(phase.amount)} {to}
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
              {canTrade && (
                <button type="button" onClick={onTrade}>
                  Canjear
                </button>
              )}
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
            Le toca a <TokenIcon token={bidder.token} size={20} /> <strong>{bidder.name}</strong> (tiene {pesos(bidder.cash)}).
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
    case "awaitingTradeResponse": {
      const { trade } = phase;
      const from = getPlayer(state, trade.fromId);
      const to = getPlayer(state, trade.toId);
      const check = checkTrade(state, trade);
      const accept: ActionRequest = { type: "acceptTrade" };
      const cancel: ActionRequest = { type: "cancelTrade" };
      return (
        <div className="prompt trade">
          <h3>
            <TokenIcon token={from.token} size={20} /> {from.name} le propone un canje a <TokenIcon token={to.token} size={20} /> {to.name}
          </h3>
          <div className="trade-sides">
            <div className="trade-side">
              <h4>{from.name} da</h4>
              <OfferItems state={state} offer={trade.gives} receiver={to.name} />
            </div>
            <div className="trade-arrow">⇄</div>
            <div className="trade-side">
              <h4>{to.name} da</h4>
              <OfferItems state={state} offer={trade.receives} receiver={from.name} />
            </div>
          </div>
          {!check.ok && <p className="trade-problem">{check.reason}</p>}
          {mine(accept) ? (
            <div className="buttons">
              <button type="button" className="primary" disabled={!check.ok} title={check.ok ? "" : check.reason} onClick={() => dispatch(accept)}>
                Aceptar
              </button>
              <button type="button" onClick={onCounter}>
                Contraofertar
              </button>
              <button type="button" className="danger" onClick={() => dispatch({ type: "rejectTrade" })}>
                Rechazar
              </button>
            </div>
          ) : mine(cancel) ? (
            <>
              {waiting(accept)}
              <div className="buttons">
                <button type="button" onClick={() => dispatch(cancel)}>
                  Retirar la propuesta
                </button>
              </div>
            </>
          ) : (
            waiting(accept)
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
            <TokenIcon token={player.token} size={20} /> Termina el turno de {player.name}
          </h3>
          {mine(action) ? (
            <>
              <p>Todavía podés construir, vender, hipotecar o proponer un canje.</p>
              <div className="buttons">
                <button type="button" className="primary" onClick={() => dispatch(action)}>
                  Terminar turno
                </button>
                <button type="button" onClick={onManage}>
                  Mis propiedades
                </button>
                {canTrade && (
                  <button type="button" onClick={onTrade}>
                    Canjear
                  </button>
                )}
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
