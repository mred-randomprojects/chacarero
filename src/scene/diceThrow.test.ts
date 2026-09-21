import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { MIN_SEPARATION, PAWN_RADIUS, flightHeight, landingSpots, seeded, separate } from "./diceThrow";

function distance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe("dice landing", () => {
  it("never lets the two dice overlap, whatever the seed", () => {
    const target = new Vector3(4, 0, -6);
    for (let seed = 1; seed < 400; seed++) {
      const { spots } = landingSpots(target, [], seeded(seed));
      expect(distance(spots[0], spots[1])).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-9);
      // And they still land near the aim point.
      for (const spot of spots) expect(distance(spot, target)).toBeLessThan(3.5);
    }
  });

  it("is the same throw for the same seed on every screen", () => {
    const target = new Vector3(1, 0, 2);
    const a = landingSpots(target, [], seeded(42));
    const b = landingSpots(target, [], seeded(42));
    expect(a.spots.map((s) => [s.x, s.z])).toEqual(b.spots.map((s) => [s.x, s.z]));
  });

  it("rolls off a pawn it would have landed on, and reports the bump", () => {
    const target = new Vector3(0, 0, 0);
    const pawn = { id: "ana", position: new Vector3(0, 0, 0) };
    let bumped = 0;
    let clear = 0;
    for (let seed = 1; seed < 400; seed++) {
      const { spots, bumps } = landingSpots(target, [pawn], seeded(seed));
      // Never inside each other; almost always clear of the pawn's foot too.
      expect(distance(spots[0], spots[1])).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-9);
      if (spots.every((spot) => distance(spot, pawn.position) >= PAWN_RADIUS - 1e-9)) clear += 1;
      if (bumps[0] || bumps[1]) bumped += 1;
    }
    expect(clear).toBeGreaterThan(380);
    // Aiming straight at a pawn, some throws must actually hit it.
    expect(bumped).toBeGreaterThan(0);
  });
});

describe("separate", () => {
  it("pushes overlapping dice apart symmetrically and leaves separated ones alone", () => {
    const a = new Vector3(0, 0.36, 0);
    const b = new Vector3(0.3, 0.36, 0);
    separate(a, b, 1);
    expect(distance(a, b)).toBeCloseTo(1, 9);
    expect(a.x).toBeCloseTo(-0.35, 9);
    expect(b.x).toBeCloseTo(0.65, 9);
    expect(a.y).toBe(0.36);
    const c = new Vector3(0, 0, 0);
    const d = new Vector3(2, 0, 0);
    separate(c, d, 1);
    expect(c.x).toBe(0);
    expect(d.x).toBe(2);
    // Exactly on top of each other: still separates, along x.
    const e = new Vector3(1, 0, 1);
    const f = new Vector3(1, 0, 1);
    separate(e, f, 1);
    expect(distance(e, f)).toBeCloseTo(1, 9);
  });
});

describe("flightHeight", () => {
  it("leaves the hand at its height, touches the felt three times and ends on it", () => {
    expect(flightHeight(0, 3, 1.2)).toBeCloseTo(3, 9);
    expect(flightHeight(0.6, 3, 1.2)).toBeCloseTo(0, 9);
    expect(flightHeight(0.8, 3, 1.2)).toBeCloseTo(0, 9);
    expect(flightHeight(0.7, 3, 1.2)).toBeGreaterThan(0);
    expect(flightHeight(1, 3, 1.2)).toBe(0);
    for (let u = 0; u <= 1; u += 0.01) expect(flightHeight(u, 3, 1.2)).toBeGreaterThanOrEqual(-1e-9);
  });
});
