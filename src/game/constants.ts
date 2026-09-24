/** Fixed numbers from the rulebook. */
export const STARTING_CASH = 35_000;
/** Starting-cash choices at setup: the rulebook's figure, and more for tables of fewer than five. */
export const STARTING_CASH_OPTIONS = [STARTING_CASH, 50_000, 70_000] as const;
/** Paid by the bank every time a player passes or lands on Salida. */
export const SALIDA_BONUS = 5_000;
/** Fine to leave the Comisaría voluntarily. */
export const JAIL_BAIL = 1_000;
/** Turns a player may wait in the Comisaría before paying. */
export const MAX_JAIL_TURNS = 3;
/** Fine for helping another player remember a prize. Yes, really. */
export const HELPING_FINE = 800;
/** Bank fee charged up-front when mortgaging or transferring a mortgaged deed. */
export const MORTGAGE_INTEREST = 0.1;
/** The bank never runs out of chacras or estancias (the box's 32 and 12 are not a rule at this table). */
export const MAX_CHACRAS_PER_CAMPO = 4;
/** Consecutive doubles that send you to the Comisaría. */
export const DOUBLES_TO_JAIL = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** Most deeds per player a table may deal out before the first roll (29 deeds / 6 players). */
export const DEAL_DEEDS_MAX = 4;
/** Deal-out choices offered at setup. */
export const DEAL_DEEDS_OPTIONS = [0, 2, 3, 4] as const;
export const BILL_DENOMINATIONS = [10, 50, 100, 200, 500, 1_000, 2_000, 5_000] as const;
export const BOARD_SIZE = 42;
/**
 * Seconds a player gets for any decision before the table decides for them.
 * Generous by default, like a real table: the clock is there for players who
 * left, not to hurry the ones who stayed. A table can pick a stricter one.
 */
export const DECISION_SECONDS = 180;
/** Decision-clock choices at setup, strictest first. */
export const DECISION_SECONDS_OPTIONS = [10, 20, 30, 60, DECISION_SECONDS] as const;
/** Choices for a separate, shorter clock on throwing the dice; null keeps the decision clock. */
export const ROLL_SECONDS_OPTIONS = [null, 5, 10, 15, 30] as const;
