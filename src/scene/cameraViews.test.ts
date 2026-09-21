import { describe, expect, it } from "vitest";
import { OVERVIEW, backOffView, orbitView, pawnView, seatView, tiltView, viewsMatch, zoomView } from "./cameraViews";
import { computeHexLayout } from "./hexLayout";

const layout = computeHexLayout({ innerRadius: 10, tileDepth: 2.4, cornerExtension: 0.9 });

describe("seatView", () => {
  it("stands outside the seat's side looking back across the board", () => {
    const view = seatView(layout, 0.45, 0);
    expect(view.position[0]).toBeCloseTo(0, 6);
    expect(view.position[2]).toBeGreaterThan(layout.outerRadius);
    expect(view.position[1]).toBeGreaterThan(10);
    expect(view.target[2]).toBeGreaterThan(0);
    expect(view.target[2]).toBeLessThan(view.position[2]);
  });

  it("is rotated by 60° per side", () => {
    const a = seatView(layout, 0.45, 0);
    const b = seatView(layout, 0.45, 1);
    const angleA = Math.atan2(a.position[2], a.position[0]);
    const angleB = Math.atan2(b.position[2], b.position[0]);
    expect(Math.abs(((angleB - angleA + Math.PI * 3) % (Math.PI * 2)) - Math.PI)).toBeCloseTo(Math.PI / 3, 6);
  });
});

describe("pawnView", () => {
  it("stands outside the ring behind the square, low, looking in across it", () => {
    const view = pawnView(layout, 3);
    const tile = layout.tiles[3];
    if (!tile) throw new Error("no tile");
    const eyeRadius = Math.hypot(view.position[0], view.position[2]);
    const tileRadius = Math.hypot(tile.center.x, tile.center.y);
    expect(eyeRadius).toBeGreaterThan(tileRadius);
    expect(view.position[1]).toBeLessThan(6);
    expect(Math.hypot(view.target[0], view.target[2])).toBeLessThan(tileRadius);
  });
});

describe("orbit / zoom / tilt", () => {
  it("keeps the distance when orbiting", () => {
    const view = orbitView(OVERVIEW, Math.PI / 2);
    const d = (v: typeof view) => Math.hypot(v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]);
    expect(d(view)).toBeCloseTo(d(OVERVIEW), 6);
    expect(view.position[1]).toBe(OVERVIEW.position[1]);
  });

  it("zooms within limits", () => {
    const closer = zoomView(OVERVIEW, 0.5);
    const d = (v: typeof closer) => Math.hypot(v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]);
    expect(d(closer)).toBeCloseTo(d(OVERVIEW) * 0.5, 6);
    expect(d(zoomView(OVERVIEW, 0.01))).toBeCloseTo(3, 6);
    expect(d(zoomView(OVERVIEW, 100))).toBeCloseTo(70, 6);
  });

  it("never tilts below the table", () => {
    let view = OVERVIEW;
    for (let i = 0; i < 20; i++) view = tiltView(view, 0.3);
    expect(view.position[1]).toBeGreaterThan(view.target[1]);
  });
});

describe("backOffView", () => {
  const cardHeight = (view: ReturnType<typeof pawnView>, ahead: number) => {
    const [px, py, pz] = view.position;
    const [tx, ty, tz] = view.target;
    const distance = Math.hypot(px - tx, py - ty, pz - tz);
    return py - ((py - ty) / distance) * ahead;
  };

  it("keeps the direction and lifts a card held 9 units ahead above the clearance", () => {
    const low = pawnView(layout, 3);
    expect(cardHeight(low, 9)).toBeLessThan(2.4);
    const backed = backOffView(low, 1.35, 9, 2.6);
    expect(cardHeight(backed, 9)).toBeGreaterThanOrEqual(2.6 - 1e-6);
    expect(backed.target).toEqual(low.target);
    // Same direction: the offset vectors are parallel.
    const a = [low.position[0] - low.target[0], low.position[1] - low.target[1], low.position[2] - low.target[2]];
    const b = [backed.position[0] - backed.target[0], backed.position[1] - backed.target[1], backed.position[2] - backed.target[2]];
    const la = Math.hypot(...a);
    const lb = Math.hypot(...b);
    for (let i = 0; i < 3; i++) expect(a[i]! / la).toBeCloseTo(b[i]! / lb, 6);
  });

  it("still backs off by the minimum factor when the camera is already high", () => {
    const backed = backOffView(OVERVIEW, 1.35, 9, 2.6);
    const d = (v: typeof backed) => Math.hypot(v.position[0] - v.target[0], v.position[1] - v.target[1], v.position[2] - v.target[2]);
    expect(d(backed)).toBeCloseTo(d(OVERVIEW) * 1.35, 6);
  });
});

describe("viewsMatch", () => {
  it("accepts small differences and rejects a camera that has moved", () => {
    const view = pawnView(layout, 3);
    const nudged = { position: [view.position[0] + 0.3, view.position[1], view.position[2] - 0.3] as const, target: [view.target[0], view.target[1] + 0.2, view.target[2]] as const };
    expect(viewsMatch(view, nudged)).toBe(true);
    expect(viewsMatch(view, OVERVIEW)).toBe(false);
    expect(viewsMatch(view, { ...view, target: [view.target[0] + 1, view.target[1], view.target[2]] })).toBe(false);
  });
});
