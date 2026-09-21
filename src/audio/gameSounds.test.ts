import { describe, expect, it } from "vitest";
import type { GameState } from "../game";
import { acceptTrade, bid, cancelTrade, counterTrade, createGame, decline, passBid, proposeTrade, rejectTrade, roll } from "../game";
import { soundsForTransition } from "./gameSounds";

const players = [
  { id: "a", name: "A", token: "tractor" as const },
  { id: "b", name: "B", token: "vaca" as const },
];

describe("soundsForTransition", () => {
  it("taps the gavel when an auction starts and on each bid, bangs it when it closes", () => {
    const start = createGame({ players, openingRoll: false, random: () => 0.5 });
    const landed = roll(start, undefined, [1, 2]);
    const auction = decline(landed);
    expect(soundsForTransition(landed, auction)).toEqual(["gavelTap"]);
    const raised = bid(auction, 500);
    expect(soundsForTransition(auction, raised)).toEqual(["gavelTap"]);
    const closed = passBid(raised);
    expect(soundsForTransition(raised, closed)).toEqual(["gavelBang", "auctionWon"]);
  });

  it("voices a trade being proposed, countered, accepted or turned down", () => {
    const start: GameState = { ...createGame({ players, openingRoll: false, random: () => 0.5 }), holdings: { "salta-sur": { ownerId: "a", chacras: 0, estancia: false, mortgaged: false } } };
    const proposed = proposeTrade(start, "b", { deeds: ["salta-sur"], cash: 0 }, { deeds: [], cash: 1_000 });
    expect(soundsForTransition(start, proposed)).toEqual(["open"]);
    const countered = counterTrade(proposed, { deeds: [], cash: 500 }, { deeds: ["salta-sur"], cash: 0 });
    expect(soundsForTransition(proposed, countered)).toEqual(["open"]);
    expect(soundsForTransition(countered, acceptTrade(countered), "acceptTrade")).toEqual(["dealDone", "auctionWon"]);
    expect(soundsForTransition(countered, rejectTrade(countered), "rejectTrade")).toEqual(["sadTrombone"]);
    expect(soundsForTransition(countered, cancelTrade(countered), "cancelTrade")).toEqual(["close"]);
  });

  it("stays quiet when nobody bid and plays the fanfare on game over", () => {
    const start = createGame({ players, openingRoll: false, random: () => 0.5 });
    const auction = decline(roll(start, undefined, [1, 2]));
    const nobody = passBid(passBid(auction));
    expect(soundsForTransition(auction, nobody)).toEqual([]);
    const over = { ...start, phase: { type: "gameOver" as const, winnerId: "a" } };
    expect(soundsForTransition(start, over)).toEqual(["win"]);
  });
});
