import type { ActionType, GameState } from "../game";
import type { SoundName } from "./sfx";

/**
 * Sounds for the parts of a state change that have no replayed animation
 * (auction bids, trade proposals and answers, and the win). Everything else
 * is voiced by the playback of events or by the scene effects themselves.
 * `action` is the request that produced `after`, when known.
 */
export function soundsForTransition(before: GameState, after: GameState, action: ActionType | null = null): SoundName[] {
  if (after.phase.type === "gameOver" && before.phase.type !== "gameOver") return ["win"];
  const sounds: SoundName[] = [];
  if (after.phase.type === "awaitingTradeResponse") {
    // A new proposal, or a counter-offer (the roles swapped).
    if (before.phase.type !== "awaitingTradeResponse" || before.phase.trade.fromId !== after.phase.trade.fromId) sounds.push("open");
  } else if (before.phase.type === "awaitingTradeResponse") {
    // A closed deal gets the jingle; a refusal gets the sad trombone (withdrawing your own offer is just a door closing).
    const accepted = after.events.some((e) => e.type === "deed");
    sounds.push(accepted ? "dealDone" : action === "rejectTrade" ? "sadTrombone" : "close");
    if (accepted) sounds.push("auctionWon");
  }
  if (after.phase.type === "auction") {
    if (before.phase.type !== "auction") sounds.push("gavelTap");
    else if (after.phase.auction.highestBid !== before.phase.auction.highestBid) sounds.push("gavelTap");
  } else if (before.phase.type === "auction" && before.phase.auction.highestBidderId !== null) {
    sounds.push("gavelBang", "auctionWon");
  }
  return sounds;
}
