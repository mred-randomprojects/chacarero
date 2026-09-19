import { describe, expect, it } from "vitest";
import { seatFrame, seatPoint, seatSides } from "./seats";
import { computeHexLayout } from "./hexLayout";

const layout = computeHexLayout({ innerRadius: 10, tileDepth: 2.4, cornerExtension: 0.9 });

describe("seatSides", () => {
  it("spreads players around the table", () => {
    expect(seatSides(2)).toEqual([0, 3]);
    expect(seatSides(3)).toEqual([0, 2, 4]);
    expect(seatSides(4)).toEqual([0, 2, 3, 5]);
    expect(seatSides(6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(seatSides(5)).size).toBe(5);
  });

  it("rejects impossible counts", () => {
    expect(() => seatSides(0)).toThrow();
    expect(() => seatSides(7)).toThrow();
  });
});

describe("seatFrame", () => {
  it("puts seat 0 below the board facing up, outside the slab", () => {
    const frame = seatFrame(layout, 0.45, 0);
    expect(frame.origin.x).toBeCloseTo(0, 6);
    expect(frame.origin.y).toBeLessThan(-layout.outerRadius * 0.8);
    expect(frame.up.x).toBeCloseTo(0, 6);
    expect(frame.up.y).toBeCloseTo(1, 6);
    expect(frame.right.x).toBeCloseTo(1, 6);
    expect(frame.outward.y).toBeCloseTo(-1, 6);
  });

  it("moves points outward when `up` is negative", () => {
    const frame = seatFrame(layout, 0.45, 3);
    const p = seatPoint(frame, 0, -2);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(Math.hypot(frame.origin.x, frame.origin.y) + 2, 6);
  });
});
