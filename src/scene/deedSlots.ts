import type { DeedId, Holding } from "../game";
import { DEEDS } from "../game";

/** A deed card lying at a seat (the same size as the one that flies there). */
export const CARD_W = 1.15;
export const CARD_H = 1.63;
const CARD_GAP = 0.12;
const CARDS_PER_ROW = 8;
/** Well clear of the bill stacks (which stand up to 0.7 above the felt), even from a low camera. */
const FIRST_ROW_UP = -3.4;
/** Rows overlap like a hand of cards; the band and name of every card stay visible. */
const ROW_STEP = CARD_H * 0.62;

export interface DeedSlot {
  /** Seat-local offsets (see `seatPoint`). */
  readonly right: number;
  readonly up: number;
  /** Height above the seat's felt, so later rows and columns lie on top of earlier ones. */
  readonly lift: number;
}

/** Where the `index`-th of `count` deed cards lies at a seat: rows of eight, centred. */
export function deedSlot(index: number, count: number): DeedSlot {
  const row = Math.floor(index / CARDS_PER_ROW);
  const col = index % CARDS_PER_ROW;
  const inRow = Math.min(count - row * CARDS_PER_ROW, CARDS_PER_ROW);
  return {
    right: (col - (inRow - 1) / 2) * (CARD_W + CARD_GAP),
    up: FIRST_ROW_UP - row * ROW_STEP,
    lift: 0.004 * (row + 1) + 0.0002 * col,
  };
}

/**
 * The deeds laid out at a seat, in board order: what the table shows as
 * theirs, minus cards flying away, plus the slots kept free for cards
 * flying in (so the others make room while the card is in the air).
 */
export function seatDeeds(
  holdings: Readonly<Partial<Record<DeedId, Holding>>>,
  playerId: string,
  incoming: ReadonlySet<DeedId>,
  outgoing: ReadonlySet<DeedId>,
): readonly DeedId[] {
  return DEEDS.filter((deed) => incoming.has(deed.id) || (holdings[deed.id]?.ownerId === playerId && !outgoing.has(deed.id))).map((deed) => deed.id);
}

/**
 * World position of every deed slot at every seat, published by the seats
 * each render and read by the deed flights, so a card leaves from where it
 * lay and lands exactly in the slot kept for it. Entries are kept after a
 * card leaves, so a flight away still knows where it started.
 */
export const seatSlots = new Map<string, Map<DeedId, readonly [number, number, number]>>();
