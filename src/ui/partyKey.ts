import type { Party } from "../game";

/** `data-party` value on a HUD card, so money flights can find their endpoints. */
export function partyKey(party: Party): string {
  return party.type === "bank" ? "bank" : `player:${party.playerId}`;
}
