/** Fixed numbers from the rulebook. */
export const STARTING_CASH = 35_000;
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
/** Buildings shipped in the box; the bank cannot sell more than these. */
export const TOTAL_CHACRAS = 32;
export const TOTAL_ESTANCIAS = 12;
export const MAX_CHACRAS_PER_CAMPO = 4;
/** Consecutive doubles that send you to the Comisaría. */
export const DOUBLES_TO_JAIL = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const BILL_DENOMINATIONS = [10, 50, 100, 200, 500, 1_000, 2_000, 5_000] as const;
export const BOARD_SIZE = 42;
