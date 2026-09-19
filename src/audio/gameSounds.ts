import type { GameState } from "../game";
import type { SoundName } from "./sfx";

/**
 * Sounds for the parts of a state change that have no replayed animation
 * (auction bids and the win). Everything else is voiced by the playback of
 * events or by the scene effects themselves.
 */
export function soundsForTransition(before: GameState, after: GameState): SoundName[] {
  if (after.phase.type === "gameOver" && before.phase.type !== "gameOver") return ["win"];
  const sounds: SoundName[] = [];
  if (after.phase.type === "auction") {
    if (before.phase.type !== "auction") sounds.push("gavelTap");
    else if (after.phase.auction.highestBid !== before.phase.auction.highestBid) sounds.push("gavelTap");
  } else if (before.phase.type === "auction" && before.phase.auction.highestBidderId !== null) {
    sounds.push("gavelBang", "auctionWon");
  }
  return sounds;
}
