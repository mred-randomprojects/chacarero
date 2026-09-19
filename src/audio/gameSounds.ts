import type { GameState } from "../game";
import { DEEDS } from "../game";
import type { SoundName } from "./sfx";

/**
 * Works out which sounds a state transition deserves by diffing the two
 * states, so the engine stays silent and the UI plays exactly what changed.
 */
export function soundsForTransition(before: GameState, after: GameState): SoundName[] {
  const sounds: SoundName[] = [];

  if (after.phase.type === "gameOver" && before.phase.type !== "gameOver") return ["win"];

  if (after.currentPlayerIndex !== before.currentPlayerIndex) sounds.push("turn");
  if (after.lastCard && after.lastCard !== before.lastCard) sounds.push("cardDraw");

  let bought = false;
  let built = false;
  let sold = false;
  let mortgaged = false;
  let unmortgaged = false;
  for (const deed of DEEDS) {
    const a = before.holdings[deed.id];
    const b = after.holdings[deed.id];
    if (!a && b) bought = true;
    if (a && b) {
      if (b.ownerId !== a.ownerId) bought = true;
      const levelA = a.estancia ? 5 : a.chacras;
      const levelB = b.estancia ? 5 : b.chacras;
      if (levelB > levelA) built = true;
      if (levelB < levelA) sold = true;
      if (!a.mortgaged && b.mortgaged) mortgaged = true;
      if (a.mortgaged && !b.mortgaged) unmortgaged = true;
    }
  }
  if (before.phase.type === "auction" && bought) sounds.push("gavelBang", "auctionWon");
  else if (bought) sounds.push("deedBuy");
  if (built) sounds.push("build");
  if (sold) sounds.push("sellBuilding");
  if (mortgaged) sounds.push("mortgage");
  if (unmortgaged) sounds.push("unmortgage");

  let cashMoved = 0;
  for (const player of after.players) {
    const previous = before.players.find((p) => p.id === player.id);
    if (!previous) continue;
    cashMoved = Math.max(cashMoved, Math.abs(player.cash - previous.cash));
    if (!previous.inJail && player.inJail) sounds.push("jail");
    if (!previous.bankrupt && player.bankrupt) sounds.push("bankrupt");
  }
  if (cashMoved >= 5_000) sounds.push("cashBig");
  else if (cashMoved > 0 && !bought) sounds.push("cash");

  if (after.phase.type === "auction") {
    const bidsBefore = before.phase.type === "auction" ? before.phase.auction.highestBid : -1;
    if (before.phase.type !== "auction") sounds.push("gavelTap");
    else if (after.phase.auction.highestBid !== bidsBefore) sounds.push("gavelTap");
  }

  return sounds;
}
