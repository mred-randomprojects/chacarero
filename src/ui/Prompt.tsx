import type { GameState } from "../game";
import {
  MIN_BID_INCREMENT,
  acknowledgeCard,
  bid,
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
  movePawn,
  passBid,
  pesos,
  settlePayment,
  buy,
} from "../game";
import type { Act } from "./ActionBar";
import { useCountdown } from "./useCountdown";

export interface PromptProps {
  readonly state: GameState;
  readonly busy: boolean;
  /** Countdowns pause while the player is inspecting a property or the list. */
  readonly inspecting: boolean;
  /** Multiplier on every countdown; 0 disables them. */
  readonly countdownScale: number;
  readonly act: Act;
  readonly onNewGame: () => void;
  /** Opens the properties list so the player can sell or mortgage before deciding. */
  readonly onManage: () => void;
}

const BUY_SECONDS = 20;
const PAY_OR_DRAW_SECONDS = 12;
const AUCTION_SECONDS = 15;
const TURN_END_SECONDS = 8;
const MOVE_SECONDS = 5;
const CARD_SECONDS = 10;

function Countdown({ remaining, total }: { readonly remaining: number | null; readonly total: number }) {
  if (remaining === null) return null;
  return (
    <div className="countdown" aria-hidden>
      <div className="countdown-bar" style={{ width: `${(remaining / total) * 100}%` }} />
      <span>{Math.ceil(remaining)}s</span>
    </div>
  );
}

/**
 * Centre-stage card for every decision the game is waiting on: buying,
 * pay-or-draw, debts, auctions and ending the turn. Decisions with a sensible
 * default run on a countdown so nobody waits on an absent player.
 */
export function Prompt({ state, busy, inspecting, countdownScale, act, onNewGame, onManage }: PromptProps) {
  const { phase } = state;
  const player = currentPlayer(state);
  // A new key restarts the countdown; the log length changes with every action.
  const stamp = `${phase.type}:${state.turn}:${state.log.length}`;
  const visible = !busy;
  const timed = countdownScale > 0;
  const scale = timed ? countdownScale : 1;

  const buyKey = visible && timed && phase.type === "awaitingBuyDecision" ? stamp : null;
  const buyLeft = useCountdown(buyKey, BUY_SECONDS * scale, inspecting, () => act(decline));
  const podKey = visible && timed && phase.type === "awaitingPayOrDraw" ? stamp : null;
  const podLeft = useCountdown(podKey, PAY_OR_DRAW_SECONDS * scale, inspecting, () => act(choosePay));
  const auctionKey = visible && timed && phase.type === "auction" ? stamp : null;
  const auctionLeft = useCountdown(auctionKey, AUCTION_SECONDS * scale, inspecting, () => act(passBid));
  const endKey = visible && timed && phase.type === "turnEnd" ? stamp : null;
  const endLeft = useCountdown(endKey, TURN_END_SECONDS * scale, inspecting, () => act(endTurn));
  const moveKey = visible && timed && phase.type === "awaitingMove" ? stamp : null;
  const moveLeft = useCountdown(moveKey, MOVE_SECONDS * scale, inspecting, () => act(movePawn));
  const cardKey = visible && timed && phase.type === "awaitingCardAck" ? stamp : null;
  const cardLeft = useCountdown(cardKey, CARD_SECONDS * scale, inspecting, () => act(acknowledgeCard));

  if (!visible) return null;

  switch (phase.type) {
    case "awaitingMove": {
      const dice = state.dice ?? [0, 0];
      const total = dice[0] + dice[1];
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name} sacó {dice[0]} + {dice[1]} = {total}
          </h3>
          <p>{dice[0] === dice[1] ? "¡Doble! Después de mover, tirás otra vez." : "Mové el peón para ver dónde caés."}</p>
          <div className="buttons">
            <button type="button" className="primary" onClick={() => act(movePawn)}>
              Mover {total} casilleros
            </button>
          </div>
          <Countdown remaining={moveLeft} total={MOVE_SECONDS * scale} />
        </div>
      );
    }
    case "awaitingCardAck": {
      const { card } = phase;
      return (
        <div className={`prompt ${card.deck}`}>
          <h3>
            <span className="dot" style={{ background: player.color }} /> {card.deck === "suerte" ? "Suerte" : "Destino"}
          </h3>
          <p className="card-text">{card.text}</p>
          <div className="buttons">
            <button type="button" className="primary" onClick={() => act(acknowledgeCard)}>
              Aplicar
            </button>
          </div>
          <Countdown remaining={cardLeft} total={CARD_SECONDS * scale} />
        </div>
      );
    }
    case "awaitingBuyDecision": {
      const deed = getDeed(phase.deedId);
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name}, caíste en {deedName(deed)}
          </h3>
          <p>
            Está libre. ¿La comprás por {pesos(deed.price)}? Si no, sale a remate.
            {player.cash < deed.price ? ` Tenés ${pesos(player.cash)}: podés hipotecar o vender antes (tecla L).` : ""}
          </p>
          <div className="buttons">
            <button type="button" className="primary" disabled={player.cash < deed.price} onClick={() => act(buy)}>
              Comprar por {pesos(deed.price)}
            </button>
            <button type="button" onClick={() => act(decline)}>
              No comprar
            </button>
            <button type="button" onClick={onManage}>
              Mis propiedades
            </button>
          </div>
          <Countdown remaining={buyLeft} total={BUY_SECONDS * scale} />
        </div>
      );
    }
    case "awaitingPayOrDraw":
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name}: pagá {pesos(phase.amount)} o levantá una tarjeta
          </h3>
          <div className="buttons">
            <button type="button" className="primary" onClick={() => act(choosePay)}>
              Pagar {pesos(phase.amount)}
            </button>
            <button type="button" onClick={() => act(chooseDraw)}>
              Levantar {phase.deck === "suerte" ? "Suerte" : "Destino"}
            </button>
          </div>
          <Countdown remaining={podLeft} total={PAY_OR_DRAW_SECONDS * scale} />
        </div>
      );
    case "awaitingPayment": {
      const debtor = getPlayer(state, phase.debtorId);
      const missing = phase.amount - debtor.cash;
      const to = phase.to.type === "bank" ? "al Banco" : `a ${getPlayer(state, phase.to.playerId).name}`;
      const stuck = !canRaiseCash(state, debtor.id);
      return (
        <div className="prompt urgent">
          <h3>
            <span className="dot" style={{ background: debtor.color }} /> {debtor.name} debe {pesos(phase.amount)} {to}
          </h3>
          <p>
            {phase.reason}.{" "}
            {missing > 0
              ? `Le faltan ${pesos(missing)}: vendé construcciones o hipotecá desde tus escrituras (o desde la lista, tecla L).`
              : "Ya tiene la plata."}
          </p>
          <div className="buttons">
            <button type="button" className="primary" disabled={missing > 0} onClick={() => act(settlePayment)}>
              Pagar
            </button>
            <button type="button" onClick={onManage}>
              Vender / hipotecar
            </button>
            <button type="button" className="danger" disabled={!stuck || missing <= 0} onClick={() => act(declareBankruptcy)}>
              Declarar quiebra
            </button>
          </div>
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
          <div className="buttons">
            {steps.map((amount) => (
              <button key={amount} type="button" className={amount === min ? "primary" : ""} disabled={amount > bidder.cash} onClick={() => act((s) => bid(s, amount))}>
                {pesos(amount)}
              </button>
            ))}
            <button type="button" className="danger" onClick={() => act(passBid)}>
              Pasar
            </button>
          </div>
          <Countdown remaining={auctionLeft} total={AUCTION_SECONDS * scale} />
        </div>
      );
    }
    case "turnEnd":
      return (
        <div className="prompt quiet">
          <h3>
            <span className="dot" style={{ background: player.color }} /> Termina el turno de {player.name}
          </h3>
          <p>Todavía podés construir, vender o hipotecar desde tus escrituras.</p>
          <div className="buttons">
            <button type="button" className="primary" onClick={() => act(endTurn)}>
              Terminar turno
            </button>
            <button type="button" onClick={onManage}>
              Mis propiedades
            </button>
          </div>
          <Countdown remaining={endLeft} total={TURN_END_SECONDS * scale} />
        </div>
      );
    case "gameOver":
      return (
        <div className="prompt">
          <h3>🏆 ¡Ganó {getPlayer(state, phase.winnerId).name}!</h3>
          <div className="buttons">
            <button type="button" className="primary" onClick={onNewGame}>
              Nueva partida
            </button>
          </div>
        </div>
      );
    default:
      return null;
  }
}
