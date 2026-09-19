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
