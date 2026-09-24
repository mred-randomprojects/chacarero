import type { GameState } from "../game";
import { phaseSeconds } from "../game";

/** The clock only shows itself for the last minute; before that nobody should feel hurried. */
export const COUNTDOWN_SHOWN_SECONDS = 60;

/**
 * Seconds of the current decision's clock that the HUD draws: the last
 * minute, or the whole clock when the table chose a shorter one.
 */
export function clockWindow(state: GameState): number {
  return Math.min(COUNTDOWN_SHOWN_SECONDS, phaseSeconds(state) ?? COUNTDOWN_SHOWN_SECONDS);
}
