import { describe, expect, it } from "vitest";
import { pawnPath, routeFor } from "./pawnPath";

describe("pawnPath", () => {
  it("walks forward one square at a time, wrapping past Salida", () => {
    expect(pawnPath(40, 2, "forward")).toEqual([40, 41, 0, 1, 2]);
  });

  it("walks backward", () => {
    expect(pawnPath(10, 1, "backward")).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(pawnPath(1, 40, "backward")).toEqual([1, 0, 41, 40]);
  });

  it("jumps in one leap and stays put when already there", () => {
    expect(pawnPath(35, 14, "jump")).toEqual([35, 14]);
    expect(pawnPath(5, 5, "forward")).toEqual([5]);
  });
});

describe("routeFor", () => {
  it("chains the legs of one action", () => {
    const moves = [
      { playerId: "a", from: 12, to: 15, kind: "forward" as const },
      { playerId: "a", from: 15, to: 12, kind: "backward" as const },
    ];
    expect(routeFor(moves, "a")).toEqual({ route: [12, 13, 14, 15, 14, 13, 12], jump: false });
  });

  it("ignores other players and empty actions", () => {
    expect(routeFor([{ playerId: "b", from: 0, to: 3, kind: "forward" }], "a")).toBeNull();
    expect(routeFor([], "a")).toBeNull();
  });

  it("flags jumps", () => {
    const moves = [
      { playerId: "a", from: 33, to: 35, kind: "forward" as const },
      { playerId: "a", from: 35, to: 14, kind: "jump" as const },
    ];
    expect(routeFor(moves, "a")).toEqual({ route: [33, 34, 35, 14], jump: true });
  });
});
