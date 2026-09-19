import { describe, expect, it } from "vitest";
import { bid, createGame, decline, passBid, roll } from "../game";
import { soundsForTransition } from "./gameSounds";

const players = [
  { id: "a", name: "A", color: "#f00" },
  { id: "b", name: "B", color: "#00f" },
];

describe("soundsForTransition", () => {
  it("taps the gavel when an auction starts and on each bid, bangs it when it closes", () => {
    const start = createGame({ players, random: () => 0.5 });
    const landed = roll(start, undefined, [1, 2]);
    const auction = decline(landed);
    expect(soundsForTransition(landed, auction)).toEqual(["gavelTap"]);
    const raised = bid(auction, 500);
    expect(soundsForTransition(auction, raised)).toEqual(["gavelTap"]);
    const closed = passBid(raised);
    expect(soundsForTransition(raised, closed)).toEqual(["gavelBang", "auctionWon"]);
  });

  it("stays quiet when nobody bid and plays the fanfare on game over", () => {
    const start = createGame({ players, random: () => 0.5 });
    const auction = decline(roll(start, undefined, [1, 2]));
    const nobody = passBid(passBid(auction));
    expect(soundsForTransition(auction, nobody)).toEqual([]);
    const over = { ...start, phase: { type: "gameOver" as const, winnerId: "a" } };
    expect(soundsForTransition(start, over)).toEqual(["win"]);
  });
});
