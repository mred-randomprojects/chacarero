/**
 * Everything both the local session and the server need to agree on about
 * time: how long a replay takes, how long each decision gets, and what
 * happens when the clock runs out.
 */
import { DEEDS } from "./deeds";
import type { GameEvent, GameState } from "./engine/state";
import { getPlayer } from "./engine/state";
import { canMortgage, canRaiseCash, canSellBuilding } from "./engine/rules";
import { declareBankruptcy, mortgage, sellBuilding, settlePayment } from "./engine/actions";
import type { ActionRequest } from "./actionRequest";

/** Seconds per pawn square: the scene hops at this pace, and the clock allows for it. No rush. */
export const SECONDS_PER_SQUARE = 0.42;
/** Seconds the replay waits before a flight or a drop, so the camera can get there first. */
export const CUE_LEAD_SECONDS = 0.4;

/**
 * Seconds a player gets for any decision before the table decides for them.
 * Generous on purpose, like a real table: the clock is there for players who
 * left, not to hurry the ones who stayed. Scaled by the countdown setting.
 */
export const DECISION_SECONDS = 180;

/** Minimum seconds an event stays on screen at the default pace. */
export function eventSeconds(event: GameEvent): number {
  switch (event.type) {
    case "log":
      return 2.0;
    case "move": {
      const distance = event.kind === "jump" ? 1 : Math.abs(event.to - event.from) === 0 ? 0 : (event.to - event.from + 42) % 42;
      const steps = event.kind === "backward" ? (event.from - event.to + 42) % 42 : distance;
      return 0.4 + steps * SECONDS_PER_SQUARE;
    }
    case "transfer":
      return 1.8 + CUE_LEAD_SECONDS;
    case "deed":
      return 1.8 + CUE_LEAD_SECONDS;
    case "building":
      return 1.4 + CUE_LEAD_SECONDS;
    case "mortgage":
      return 1.8;
    case "card":
      return 1.6;
    case "jail":
      return 1.8;
    case "bankrupt":
      return 2.6;
    case "turn":
      return 1.2;
  }
}

/** Total seconds a client needs to replay `events` at pace `scale` (1 = default). */
export function replaySeconds(events: readonly GameEvent[], scale = 1): number {
  return events.reduce((sum, event) => sum + eventSeconds(event) * scale, 0);
}

/**
 * Seconds a player gets to decide in the current phase before the default
 * kicks in: the same for every decision. Null means no clock (game over).
 */
export function phaseSeconds(state: GameState): number | null {
  return state.phase.type === "gameOver" ? null : DECISION_SECONDS;
}

/** What the table does for an absent or undecided player when the clock runs out. */
export function defaultAction(state: GameState): ActionRequest | null {
  switch (state.phase.type) {
    case "openingRoll":
    case "awaitingRoll":
    case "awaitingJailDecision":
      return { type: "rollDice" };
    case "awaitingMove":
      return { type: "movePawn" };
    case "awaitingDraw":
      return { type: "drawCard" };
    case "awaitingCardAck":
      return { type: "acknowledgeCard" };
    case "awaitingBuyDecision":
      return { type: "decline" };
    case "awaitingPayOrDraw":
      return { type: "choosePay" };
    case "auction":
      return { type: "passBid" };
    case "awaitingTradeResponse":
      return { type: "rejectTrade" };
    case "turnEnd":
      return { type: "endTurn" };
    case "awaitingPayment":
      return { type: "settlePayment" };
    case "gameOver":
      return null;
  }
}

/**
 * Settles a debt the slow way when the debtor never acts: sells buildings,
 * then mortgages, until the debt is covered; pays it, or goes bankrupt when
 * nothing is left.
 */
export function autoResolveDebt(input: GameState): GameState {
  let state = input;
  if (state.phase.type !== "awaitingPayment") return state;
  const { debtorId, amount } = state.phase;
  let guard = 0;
  while (getPlayer(state, debtorId).cash < amount && guard++ < 200) {
    const debtor = getPlayer(state, debtorId);
    const sellable = DEEDS.find((d) => state.holdings[d.id]?.ownerId === debtorId && canSellBuilding(state, debtor, d.id).ok);
    if (sellable) {
      state = sellBuilding(state, sellable.id);
      continue;
    }
    const mortgageable = DEEDS.find((d) => state.holdings[d.id]?.ownerId === debtorId && canMortgage(state, debtor, d.id).ok);
    if (mortgageable) {
      state = mortgage(state, mortgageable.id);
      continue;
    }
    break;
  }
  if (state.phase.type !== "awaitingPayment") return state;
  if (getPlayer(state, debtorId).cash >= amount) return settlePayment(state);
  if (!canRaiseCash(state, debtorId)) return declareBankruptcy(state);
  return state;
}
