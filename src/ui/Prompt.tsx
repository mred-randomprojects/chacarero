import type { GameState } from "../game";
import {
  MIN_BID_INCREMENT,
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
  readonly act: Act;
  readonly onNewGame: () => void;
}

const BUY_SECONDS = 20;
const PAY_OR_DRAW_SECONDS = 12;
const AUCTION_SECONDS = 15;
const TURN_END_SECONDS = 8;

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
export function Prompt({ state, busy, inspecting, act, onNewGame }: PromptProps) {
  const { phase } = state;
  const player = currentPlayer(state);
  // A new key restarts the countdown; the log length changes with every action.
  const stamp = `${phase.type}:${state.turn}:${state.log.length}`;
  const visible = !busy;

  const buyKey = visible && phase.type === "awaitingBuyDecision" ? stamp : null;
  const buyLeft = useCountdown(buyKey, BUY_SECONDS, inspecting, () => act(decline));
  const podKey = visible && phase.type === "awaitingPayOrDraw" ? stamp : null;
  const podLeft = useCountdown(podKey, PAY_OR_DRAW_SECONDS, inspecting, () => act(choosePay));
  const auctionKey = visible && phase.type === "auction" ? stamp : null;
  const auctionLeft = useCountdown(auctionKey, AUCTION_SECONDS, inspecting, () => act(passBid));
  const endKey = visible && phase.type === "turnEnd" ? stamp : null;
  const endLeft = useCountdown(endKey, TURN_END_SECONDS, inspecting, () => act(endTurn));

  if (!visible) return null;

  switch (phase.type) {
    case "awaitingBuyDecision": {
      const deed = getDeed(phase.deedId);
      return (
        <div className="prompt">
          <h3>
            <span className="dot" style={{ background: player.color }} /> {player.name}, caíste en {deedName(deed)}
          </h3>
          <p>Está libre. ¿La comprás por {pesos(deed.price)}? Si no, sale a remate.</p>
          <div className="buttons">
            <button type="button" className="primary" disabled={player.cash < deed.price} onClick={() => act(buy)}>
              Comprar por {pesos(deed.price)}
            </button>
            <button type="button" onClick={() => act(decline)}>
              No comprar
            </button>
          </div>
          <Countdown remaining={buyLeft} total={BUY_SECONDS} />
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
          <Countdown remaining={podLeft} total={PAY_OR_DRAW_SECONDS} />
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
          <Countdown remaining={auctionLeft} total={AUCTION_SECONDS} />
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
          </div>
          <Countdown remaining={endLeft} total={TURN_END_SECONDS} />
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
