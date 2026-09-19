import { describe, expect, it } from "vitest";
import { pawnPath } from "./pawnPath";

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
