import type { Vector3 } from "three";

export interface Knock {
  /** Seconds since the hit. */
  t: number;
  /** Horizontal unit direction the pawn was pushed in. */
  dir: Vector3;
}

/**
 * Pawns a die has just bumped into, written by the dice and read by each
 * Pawn in its frame loop so it can wobble. Shared object, same idea as
 * pawnTracker: nothing here goes through React.
 */
export const pawnKnocks = new Map<string, Knock>();

/** Whether Space/Enter asked the dice presentation to finish early (a counter, so repeats are distinct). */
export const diceHurry = { requested: 0 };
