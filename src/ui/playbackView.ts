/**
 * What the table shows while an action is being replayed step by step. The
 * view lags the real game state: cash and deeds move as their events play,
 * and anything that belongs to the *next* step (the deed lifted on offer,
 * the phase the prompt reacts to) only appears once the replay is over.
 * Pure functions, so the rules are testable without React or Three.
 */
import type { Card, DeedId, GameEvent, GameState, Holding, Phase } from "../game";

export interface ViewState {
  readonly cash: Readonly<Record<string, number>>;
  readonly holdings: Readonly<Partial<Record<DeedId, Holding>>>;
  /** The phase the table is at; the real one only once the replay has caught up. */
  readonly phase: Phase;
  /** Suerte/Destino card face up on the table. */
  readonly cardOnTable: Card | null;
  /** Deed lifted in front of everyone: on offer to the player who landed on it, or under the hammer. */
  readonly deedOnOffer: DeedId | null;
}

/** The card a phase keeps face up, looking through a trade that interrupted the step. */
export function cardIn(phase: Phase): Card | null {
  if (phase.type === "awaitingCardAck") return phase.card;
  if (phase.type === "awaitingTradeResponse") return cardIn(phase.resume);
  return null;
}

/** The deed a phase has lifted, looking through a trade that interrupted the step. */
export function offeredDeedIn(phase: Phase): DeedId | null {
  if (phase.type === "awaitingBuyDecision") return phase.deedId;
  if (phase.type === "auction") return phase.auction.deedId;
  if (phase.type === "awaitingTradeResponse") return offeredDeedIn(phase.resume);
  return null;
}

/** The view of a state nothing is being replayed for: everything as it really is. */
export function viewOf(state: GameState): ViewState {
  return {
    cash: Object.fromEntries(state.players.map((p) => [p.id, p.cash])),
    holdings: state.holdings,
    phase: state.phase,
    cardOnTable: cardIn(state.phase),
    deedOnOffer: offeredDeedIn(state.phase),
  };
}

/**
 * The first thing a replay does: whatever the new state no longer holds up
 * (the card just applied, the deed just bought or auctioned) goes down at
 * once; whatever it still holds up stays. Nothing new is lifted here.
 */
export function beginReplay(view: ViewState, after: GameState): ViewState {
  const card = cardIn(after.phase);
  const deed = offeredDeedIn(after.phase);
  return {
    ...view,
    cardOnTable: card !== null && view.cardOnTable !== null && card.id === view.cardOnTable.id ? view.cardOnTable : null,
    deedOnOffer: deed !== null && deed === view.deedOnOffer ? view.deedOnOffer : null,
  };
}

/** One replayed step lands: the table changes exactly as much as that event says. */
export function applyEvent(view: ViewState, event: GameEvent, final: GameState): ViewState {
  switch (event.type) {
    case "transfer": {
      const cash = { ...view.cash };
      if (event.from.type === "player") cash[event.from.playerId] = (cash[event.from.playerId] ?? 0) - event.amount;
      if (event.to.type === "player") cash[event.to.playerId] = (cash[event.to.playerId] ?? 0) + event.amount;
      return { ...view, cash };
    }
    case "deed": {
      const holdings = { ...view.holdings };
      if (event.to.type === "player") {
        const settled = final.holdings[event.deedId];
        holdings[event.deedId] = { ownerId: event.to.playerId, chacras: 0, estancia: false, mortgaged: settled?.mortgaged ?? false };
      } else {
        delete holdings[event.deedId];
      }
      return { ...view, holdings };
    }
    case "building": {
      const holding = view.holdings[event.deedId];
      if (!holding) return view;
      return { ...view, holdings: { ...view.holdings, [event.deedId]: { ...holding, chacras: event.chacras, estancia: event.estancia } } };
    }
    case "mortgage": {
      const holding = view.holdings[event.deedId];
      if (!holding) return view;
      return { ...view, holdings: { ...view.holdings, [event.deedId]: { ...holding, mortgaged: event.mortgaged } } };
    }
    case "card": {
      // The card comes up the moment it is drawn, not before.
      const card = cardIn(final.phase);
      return { ...view, cardOnTable: card && card.id === event.cardId ? card : view.cardOnTable };
    }
    default:
      return view;
  }
}
