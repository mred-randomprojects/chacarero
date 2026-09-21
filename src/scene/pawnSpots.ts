import { Vector3 } from "three";
import type { HexLayout } from "./hexLayout";
import { pawnPosition } from "./hexLayout";
import { boardToWorld } from "./tileGeometry";

/** Pawn slots on a tile are this fraction of the tile width apart. */
export const PAWN_SPACING_RATIO = 0.36;

/** World position of the pawn in slot `slot` standing on ring square `square`. */
export function pawnWorld(layout: HexLayout, square: number, slot: number, y = 0): Vector3 {
  const tile = layout.tiles[square];
  if (!tile) throw new Error(`No tile ${square}`);
  return new Vector3(...boardToWorld(pawnPosition(tile, slot, layout.tileWidth * PAWN_SPACING_RATIO), y));
}

/** Where a throw aims: on the felt just inside the ring, in front of square `square`. */
export function throwTarget(layout: HexLayout, square: number): Vector3 {
  const tile = layout.tiles[square];
  if (!tile) throw new Error(`No tile ${square}`);
  const inward = 1.6;
  return new Vector3(...boardToWorld({ x: tile.center.x + tile.up.x * inward, y: tile.center.y + tile.up.y * inward }, 0));
}
