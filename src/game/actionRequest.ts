/**
 * The wire form of a player's move. Both the local (hot-seat) session and
 * the online server turn one of these into an engine call, so the UI never
 * has to know which mode it is in.
 */
import type { DeedId } from "./types";
import type { GameState, TradeOffer } from "./engine/state";
import { activePlayer, currentPlayer } from "./engine/state";
import { canManageHoldings, canProposeTrade } from "./engine/rules";
import {
  acceptTrade,
  acknowledgeCard,
  bid,
  buildChacra,
  buildEstancia,
  buy,
  cancelTrade,
  chooseDraw,
  choosePay,
  counterTrade,
  declareBankruptcy,
  decline,
  endTurn,
  mortgage,
  movePawn,
  passBid,
  payBail,
  proposeTrade,
  rejectTrade,
  rollDice,
  sellBuilding,
  settlePayment,
  unmortgage,
  spendJailCard,
} from "./engine/actions";
import type { Dice } from "./engine/actions";

export type ActionRequest =
  | { readonly type: "rollDice" }
  | { readonly type: "movePawn" }
  | { readonly type: "acknowledgeCard" }
  | { readonly type: "buy" }
  | { readonly type: "decline" }
  | { readonly type: "choosePay" }
  | { readonly type: "chooseDraw" }
  | { readonly type: "payBail" }
  | { readonly type: "spendJailCard" }
  | { readonly type: "endTurn" }
  | { readonly type: "bid"; readonly amount: number }
  | { readonly type: "passBid" }
  | { readonly type: "buildChacra"; readonly deedId: DeedId }
  | { readonly type: "buildEstancia"; readonly deedId: DeedId }
  | { readonly type: "sellBuilding"; readonly deedId: DeedId }
  | { readonly type: "mortgage"; readonly deedId: DeedId }
  | { readonly type: "unmortgage"; readonly deedId: DeedId }
  | { readonly type: "settlePayment" }
  | { readonly type: "declareBankruptcy" }
  | { readonly type: "proposeTrade"; readonly toId: string; readonly gives: TradeOffer; readonly receives: TradeOffer }
  | { readonly type: "acceptTrade" }
  | { readonly type: "rejectTrade" }
  | { readonly type: "cancelTrade" }
  | { readonly type: "counterTrade"; readonly gives: TradeOffer; readonly receives: TradeOffer };

export type ActionType = ActionRequest["type"];

/**
 * Who is allowed to send a request in the current phase: the player on turn
 * for turn actions, the debtor or bidder where the engine says so, and the
 * two parties of a trade while one is on the table.
 */
export function allowedPlayerFor(state: GameState, request: ActionRequest): string | null {
  const { phase } = state;
  if (phase.type === "gameOver") return null;
  switch (request.type) {
    case "rollDice":
    case "payBail":
    case "spendJailCard":
      return phase.type === "awaitingRoll" || phase.type === "awaitingJailDecision" ? currentPlayer(state).id : null;
    case "movePawn":
      return phase.type === "awaitingMove" ? currentPlayer(state).id : null;
    case "acknowledgeCard":
      return phase.type === "awaitingCardAck" ? currentPlayer(state).id : null;
    case "buy":
    case "decline":
      return phase.type === "awaitingBuyDecision" ? currentPlayer(state).id : null;
    case "choosePay":
    case "chooseDraw":
      return phase.type === "awaitingPayOrDraw" ? currentPlayer(state).id : null;
    case "endTurn":
      return phase.type === "turnEnd" ? currentPlayer(state).id : null;
    case "bid":
    case "passBid":
      return phase.type === "auction" ? phase.auction.turnBidderId : null;
    case "settlePayment":
    case "declareBankruptcy":
      return phase.type === "awaitingPayment" ? phase.debtorId : null;
    case "buildChacra":
    case "buildEstancia":
    case "sellBuilding":
    case "mortgage":
    case "unmortgage":
      return canManageHoldings(state) ? activePlayer(state).id : null;
    case "proposeTrade":
      return canManageHoldings(state) && canProposeTrade(state) ? activePlayer(state).id : null;
    case "acceptTrade":
    case "rejectTrade":
    case "counterTrade":
      return phase.type === "awaitingTradeResponse" ? phase.trade.toId : null;
    case "cancelTrade":
      return phase.type === "awaitingTradeResponse" ? phase.trade.fromId : null;
  }
}

/**
 * Applies a request. Dice are supplied by the caller (the server picks them)
 * so the result is reproducible.
 */
export function applyActionRequest(state: GameState, request: ActionRequest, dice?: Dice): GameState {
  switch (request.type) {
    case "rollDice":
      return rollDice(state, Math.random, dice);
    case "movePawn":
      return movePawn(state);
    case "acknowledgeCard":
      return acknowledgeCard(state);
    case "buy":
      return buy(state);
    case "decline":
      return decline(state);
    case "choosePay":
      return choosePay(state);
    case "chooseDraw":
      return chooseDraw(state);
    case "payBail":
      return payBail(state);
    case "spendJailCard":
      return spendJailCard(state);
    case "endTurn":
      return endTurn(state);
    case "bid":
      return bid(state, request.amount);
    case "passBid":
      return passBid(state);
    case "buildChacra":
      return buildChacra(state, request.deedId);
    case "buildEstancia":
      return buildEstancia(state, request.deedId);
    case "sellBuilding":
      return sellBuilding(state, request.deedId);
    case "mortgage":
      return mortgage(state, request.deedId);
    case "unmortgage":
      return unmortgage(state, request.deedId);
    case "settlePayment":
      return settlePayment(state);
    case "declareBankruptcy":
      return declareBankruptcy(state);
    case "proposeTrade":
      return proposeTrade(state, request.toId, request.gives, request.receives);
    case "acceptTrade":
      return acceptTrade(state);
    case "rejectTrade":
      return rejectTrade(state);
    case "cancelTrade":
      return cancelTrade(state);
    case "counterTrade":
      return counterTrade(state, request.gives, request.receives);
  }
}
