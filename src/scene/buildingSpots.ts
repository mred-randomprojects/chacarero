import { Vector3 } from "three";
import type { DeedId } from "../game";
import { SQUARES } from "../game";
import type { HexLayout, TileLayout, Vec2 } from "./hexLayout";
import { boardToWorld } from "./tileGeometry";

/** Board-space point `right` units along the tile's right axis and `up` along its up axis from its centre. */
export function local(tile: TileLayout, right: number, up: number): Vec2 {
  return {
    x: tile.center.x + tile.right.x * right + tile.up.x * up,
    y: tile.center.y + tile.right.y * right + tile.up.y * up,
  };
}

/**
 * Rotation about Y that aligns a box's local +x with the tile's `right` vector.
 * Board (x, y) maps to world (x, -z), and a yaw θ sends +x to (cos θ, 0, -sin θ).
 */
export function yaw(tile: TileLayout): number {
  return Math.atan2(tile.right.y, tile.right.x);
}

const DEED_SQUARES = new Map<DeedId, number>();
for (const square of SQUARES) {
  if (square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania") {
    DEED_SQUARES.set(square.deedId, square.index);
  }
}

/** Ring index of the square holding a deed. */
export function layoutIndexFor(deedId: DeedId): number {
  const index = DEED_SQUARES.get(deedId);
  if (index === undefined) throw new Error(`No square for ${deedId}`);
  return index;
}

/** World position and yaw of building slot `index` of `total` on a campo, for drop animations. */
export function buildingSpot(layout: HexLayout, deedId: DeedId, index: number, total: number): { position: Vector3; yaw: number } {
  const tile = layout.tiles[layoutIndexFor(deedId)];
  if (!tile) throw new Error(`No tile for ${deedId}`);
  const depth = tile.localBounds.max.y - tile.localBounds.min.y;
  const bandY = tile.localBounds.max.y - depth * 0.1;
  const offset = total <= 1 ? 0 : (index - (total - 1) / 2) * 0.3;
  const [x, y, z] = boardToWorld(local(tile, offset, bandY), 0);
  return { position: new Vector3(x, y, z), yaw: yaw(tile) };
}

