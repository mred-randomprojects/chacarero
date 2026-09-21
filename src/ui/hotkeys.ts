/**
 * One key per action button, shown on the button and honoured by the
 * keyboard. Space/Enter only ever advance harmless steps (see
 * `primaryAction`); anything with consequences — buying, bidding,
 * accepting a deal, choosing to pay — has its own letter, so a key held
 * down to hurry the banners can never spend money.
 */
import type { ActionRequest, GameState } from "../game";
import { JAIL_BAIL, MIN_BID_INCREMENT, checkTrade, currentPlayer, getDeed, getPlayer } from "../game";
import { canAct } from "./perspective";

/** Keys the camera and the HUD use, which action keys must not collide with. */
export const UI_KEYS = {
  trade: "n",
  map: "l",
  settings: ",",
  mySeat: "m",
  overview: "0",
  topDown: "t",
  /** `1`–`6` sit at each player's place. */
} as const;

export interface Hotkey {
  /** Lower-case key, as `KeyboardEvent.key`. */
  readonly key: string;
  readonly action: ActionRequest;
}

/** What each letter does in the current phase, for the screen `you` (null at a shared table); only enabled buttons get a key. */
export function actionHotkeys(state: GameState, you: string | null): readonly Hotkey[] {
  const { phase } = state;
  const player = currentPlayer(state);
  const keys: Hotkey[] = [];
  const add = (key: string, action: ActionRequest, enabled = true) => {
    if (enabled && canAct(state, you, action)) keys.push({ key, action });
  };
  switch (phase.type) {
    case "awaitingJailDecision":
      add("p", { type: "payBail" }, player.cash >= JAIL_BAIL);
      add("u", { type: "spendJailCard" }, player.getOutOfJailCards > 0);
      break;
    case "awaitingBuyDecision":
      add("c", { type: "buy" }, player.cash >= getDeed(phase.deedId).price);
      add("r", { type: "decline" });
      break;
    case "awaitingPayOrDraw":
      add("p", { type: "choosePay" });
      add("e", { type: "chooseDraw" });
      break;
    case "awaitingPayment": {
      const debtor = getPlayer(state, phase.debtorId);
      // Bankruptcy is never one key away.
      add("p", { type: "settlePayment" }, debtor.cash >= phase.amount);
      break;
    }
    case "auction": {
      const bidder = getPlayer(state, phase.auction.turnBidderId);
      const min = phase.auction.highestBid + MIN_BID_INCREMENT;
      add("b", { type: "bid", amount: min }, bidder.cash >= min);
      add("x", { type: "passBid" });
      break;
    }
    case "awaitingTradeResponse":
      add("a", { type: "acceptTrade" }, checkTrade(state, phase.trade).ok);
      add("x", { type: "rejectTrade" });
      add("x", { type: "cancelTrade" });
      break;
    default:
      break;
  }
  return keys;
}

/** The action a key press means right now, if any. */
export function actionForKey(state: GameState, you: string | null, key: string): ActionRequest | null {
  return actionHotkeys(state, you).find((h) => h.key === key.toLowerCase())?.action ?? null;
}

/** How a key is printed on a button: "Espacio" for the harmless steps, the letter otherwise. */
export function keyLabel(key: string): string {
  if (key === " ") return "Espacio";
  if (key === ",") return ",";
  return key.toUpperCase();
}
