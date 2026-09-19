import { describe, expect, it } from "vitest";
import { OVERVIEW, orbitView, seatView, tiltView, zoomView } from "./cameraViews";
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
    expect(d(zoomView(OVERVIEW, 0.01))).toBeCloseTo(10, 6);
    expect(d(zoomView(OVERVIEW, 100))).toBeCloseTo(70, 6);
  });

  it("never tilts below the table", () => {
    let view = OVERVIEW;
    for (let i = 0; i < 20; i++) view = tiltView(view, 0.3);
    expect(view.position[1]).toBeGreaterThan(view.target[1]);
  });
});
