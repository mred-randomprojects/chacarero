/**
 * The geometry of a throw, kept pure so it can be tested: where the two
 * dice land, how they are kept from passing through each other and through
 * the pawns, and the height profile of the flight.
 */
import { Vector3 } from "three";

export const DIE_SIZE = 0.72;
/** Resting dice never sit closer than this (centre to centre): a die's diagonal plus a little felt. */
export const MIN_SEPARATION = DIE_SIZE * 1.45;
/** A die closer than this to a pawn's foot bumps it and rolls off. */
export const PAWN_RADIUS = 0.62;
/** How far a die scatters around the aim point. */
const SCATTER = 1.5;

export interface Obstacle {
  readonly id: string;
  readonly position: Vector3;
}

/** Small deterministic generator (mulberry32), so every screen computes the same throw from the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pushes `a` and `b` apart along the line between them until they are `minDistance` apart (horizontally), each moving half. */
export function separate(a: Vector3, b: Vector3, minDistance: number): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= minDistance) return;
  let nx: number;
  let nz: number;
  if (distance < 1e-6) {
    nx = 1;
    nz = 0;
  } else {
    nx = dx / distance;
    nz = dz / distance;
  }
  const push = (minDistance - distance) / 2;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
}

/** A die aimed at a pawn's feet lands beside it instead; returns the pawn it bumps, if any. */
export function deflectFromPawns(spot: Vector3, obstacles: readonly Obstacle[], random: () => number): Obstacle | null {
  const hit = obstacles.find((p) => Math.hypot(p.position.x - spot.x, p.position.z - spot.z) < PAWN_RADIUS);
  if (!hit) return null;
  const away = new Vector3(spot.x - hit.position.x, 0, spot.z - hit.position.z);
  if (away.lengthSq() < 1e-4) away.set(Math.cos(random() * Math.PI * 2), 0, Math.sin(random() * Math.PI * 2));
  away.normalize();
  spot.copy(hit.position).addScaledVector(away, PAWN_RADIUS + 0.25);
  spot.y = 0;
  return hit;
}

export interface Landing {
  readonly spots: readonly [Vector3, Vector3];
  /** Pawn each die bumps on landing, if any. */
  readonly bumps: readonly [Obstacle | null, Obstacle | null];
}

/**
 * Where the two dice come to rest: scattered around `target`, off any pawn
 * they would have landed on, and never overlapping each other. `y` is left
 * at 0; the caller sets the resting height.
 */
export function landingSpots(target: Vector3, obstacles: readonly Obstacle[], random: () => number): Landing {
  const spots = [0, 1].map((index) => {
    const angle = random() * Math.PI * 2;
    const radius = 0.4 + random() * SCATTER;
    return new Vector3(target.x + Math.cos(angle) * radius + (index === 0 ? -0.5 : 0.5), 0, target.z + Math.sin(angle) * radius);
  }) as [Vector3, Vector3];
  const bumps = spots.map((spot) => deflectFromPawns(spot, obstacles, random)) as [Obstacle | null, Obstacle | null];
  // Separating may push a die back onto a pawn and deflecting may bring the dice together again:
  // alternate a few times, and always finish by separating, because two dice inside each other
  // look far worse than a die touching a pawn's foot (the pawn gets knocked either way).
  for (let i = 0; i < 4; i++) {
    separate(spots[0], spots[1], MIN_SEPARATION);
    let moved = false;
    for (const spot of spots) {
      const again = obstacles.find((p) => Math.hypot(p.position.x - spot.x, p.position.z - spot.z) < PAWN_RADIUS);
      if (again) {
        deflectFromPawns(spot, obstacles, random);
        moved = true;
      }
    }
    if (!moved) break;
  }
  separate(spots[0], spots[1], MIN_SEPARATION);
  return { spots, bumps };
}

/**
 * Height above the table during flight, as a share `u` of the flight: a lob
 * from `startHeight` down to the felt, then two small bounces.
 */
export function flightHeight(u: number, startHeight: number, arc: number): number {
  if (u < 0.6) {
    const a = u / 0.6;
    return startHeight * (1 - a) + arc * 4 * a * (1 - a);
  }
  if (u < 0.8) return Math.sin(((u - 0.6) / 0.2) * Math.PI) * 0.45;
  if (u < 0.95) return Math.sin(((u - 0.8) / 0.15) * Math.PI) * 0.14;
  return 0;
}
