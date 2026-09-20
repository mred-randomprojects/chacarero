import type { ActionRequest, GameState } from "../game";
import { MIN_BID_INCREMENT, allowedPlayerFor, checkTrade, currentPlayer, getDeed, getPlayer } from "../game";

/**
 * Whether this screen may send `action` now. At a shared table (`you` null)
 * whoever the engine expects is assumed to be holding the mouse; online only
 * that player's own screen gets the buttons.
 */
export function canAct(state: GameState, you: string | null, action: ActionRequest): boolean {
  const allowed = allowedPlayerFor(state, action);
  if (allowed === null) return false;
  return you === null || allowed === you;
}

/** "Esperando a Beto…" for the player the engine is waiting on. */
export function waitingFor(state: GameState, action: ActionRequest): string {
  const allowed = allowedPlayerFor(state, action);
  return allowed ? `Esperando a ${getPlayer(state, allowed).name}…` : "";
}

/** Payload does not matter for who may propose, so one probe serves every check. */
const PROPOSE_PROBE: ActionRequest = { type: "proposeTrade", toId: "", gives: { deeds: [], cash: 0 }, receives: { deeds: [], cash: 0 } };

/**
 * The player who may put a trade on the table from this screen right now, or
 * null: the one who must act, provided they are at this screen and someone
 * else is still in the game.
 */
export function tradeProposer(state: GameState, you: string | null): string | null {
  const allowed = allowedPlayerFor(state, PROPOSE_PROBE);
  if (allowed === null || (you !== null && allowed !== you)) return null;
  return state.players.some((p) => p.id !== allowed && !p.bankrupt) ? allowed : null;
}

/**
 * The highlighted button of the current prompt, as an action, when this
 * screen may press it right now: move the pawn, apply the card, buy, pay,
 * the minimum bid, accept the trade, end the turn. Null when there is no
 * prompt (the dice are handled by holding Space), when it is not this
 * screen's call, or when the button would be disabled. Mirrors the
 * `disabled` conditions of the primary buttons in Prompt.
 */
export function primaryAction(state: GameState, you: string | null): ActionRequest | null {
  const { phase } = state;
  let action: ActionRequest | null = null;
  switch (phase.type) {
    case "awaitingMove":
      action = { type: "movePawn" };
      break;
    case "awaitingCardAck":
      action = { type: "acknowledgeCard" };
      break;
    case "awaitingBuyDecision":
      action = currentPlayer(state).cash >= getDeed(phase.deedId).price ? { type: "buy" } : null;
      break;
    case "awaitingPayOrDraw":
      action = { type: "choosePay" };
      break;
    case "awaitingPayment":
      action = getPlayer(state, phase.debtorId).cash >= phase.amount ? { type: "settlePayment" } : null;
      break;
    case "auction": {
      const amount = phase.auction.highestBid + MIN_BID_INCREMENT;
      action = getPlayer(state, phase.auction.turnBidderId).cash >= amount ? { type: "bid", amount } : null;
      break;
    }
    case "awaitingTradeResponse":
      action = checkTrade(state, phase.trade).ok ? { type: "acceptTrade" } : null;
      break;
    case "turnEnd":
      action = { type: "endTurn" };
      break;
    case "awaitingRoll":
    case "awaitingJailDecision":
    case "gameOver":
      action = null;
      break;
  }
  return action !== null && canAct(state, you, action) ? action : null;
}
