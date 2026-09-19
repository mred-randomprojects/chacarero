/**
 * Seating around the hexagonal table. Each of the six sides is a seat; the
 * player's money and deeds are laid out on the table outside their side, and
 * the camera "sits" there when it is their turn.
 */
import type { HexLayout, Vec2 } from "./hexLayout";
import { hexagonVertices } from "./hexLayout";

export interface SeatFrame {
  /** Side index 0-5, matching `TileLayout.side`. */
  readonly side: number;
  /** Board-space point on the outer edge of the slab, centred on the side. */
  readonly origin: Vec2;
  /** Unit vector pointing towards the board centre. */
  readonly up: Vec2;
  /** Unit vector pointing to the seated player's right. */
  readonly right: Vec2;
  /** Unit vector pointing away from the board (where the player sits). */
  readonly outward: Vec2;
}

/**
 * Which sides `count` players occupy, spread as evenly as the hexagon allows:
 * two players sit opposite each other, three at every other side, and so on.
 */
export function seatSides(count: number): number[] {
  if (count < 1 || count > 6) throw new Error("A table seats 1 to 6 players");
  return Array.from({ length: count }, (_, i) => Math.round((i * 6) / count) % 6);
}

/** Geometry of the seat outside side `side`, `margin` beyond the slab edge. */
export function seatFrame(layout: HexLayout, slabMargin: number, side: number): SeatFrame {
  const outerRadius = layout.outerRadius + slabMargin;
  const vertices = hexagonVertices(outerRadius);
  const a = vertices[side];
  const b = vertices[(side + 1) % 6];
  if (!a || !b) throw new Error(`Invalid side ${side}`);
  const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const length = Math.hypot(origin.x, origin.y);
  const outward = { x: origin.x / length, y: origin.y / length };
  const up = { x: -outward.x, y: -outward.y };
  const right = { x: up.y, y: -up.x };
  return { side, origin, up, right, outward };
}

/** Board-space point at (`right`, `up`) in a seat's local frame. */
export function seatPoint(frame: SeatFrame, right: number, up: number): Vec2 {
  return {
    x: frame.origin.x + frame.right.x * right + frame.up.x * up,
    y: frame.origin.y + frame.right.y * right + frame.up.y * up,
  };
}

/** Yaw about world Y that aligns a mesh's local +x with the seat's `right`. */
export function seatYaw(frame: SeatFrame): number {
  return Math.atan2(frame.right.y, frame.right.x);
}
