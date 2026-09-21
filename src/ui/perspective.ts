import type { ActionRequest, GameState } from "../game";
import { allowedPlayerFor, getPlayer } from "../game";

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
 * What Space/Enter do right now, when this screen may act: only the
 * harmless steps — move the pawn, lift or apply the card, end the turn.
 * Never a decision with consequences (buying, bidding, paying, accepting a
 * deal): those have their own letters (see hotkeys.ts), so a key held down
 * to hurry the banners can never spend money. Null when there is no such
 * step (the dice are handled by holding Space) or it is not this screen's
 * call.
 */
export function primaryAction(state: GameState, you: string | null): ActionRequest | null {
  const { phase } = state;
  let action: ActionRequest | null = null;
  switch (phase.type) {
    case "awaitingMove":
      action = { type: "movePawn" };
      break;
    case "awaitingDraw":
      action = { type: "drawCard" };
      break;
    case "awaitingCardAck":
      action = { type: "acknowledgeCard" };
      break;
    case "turnEnd":
      action = { type: "endTurn" };
      break;
    case "awaitingBuyDecision":
    case "awaitingPayOrDraw":
    case "awaitingPayment":
    case "auction":
    case "awaitingTradeResponse":
    case "openingRoll":
    case "awaitingRoll":
    case "awaitingJailDecision":
    case "gameOver":
      action = null;
      break;
  }
  return action !== null && canAct(state, you, action) ? action : null;
}
