import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from "three";
import type { TileLayout, Vec2 } from "./hexLayout";
import { polygonArea } from "./hexLayout";

/** Maps a board-space point onto the XZ plane at height `y`. */
export function boardToWorld(point: Vec2, y: number): [number, number, number] {
  return [point.x, y, -point.y];
}

/**
 * Builds a flat, upward-facing geometry for a tile outline, with UVs that map
 * the tile's local bounding box onto the unit square so a canvas drawn in the
 * same local frame lands exactly on the tile.
 */
export function createTileGeometry(tile: TileLayout, y: number): BufferGeometry {
  const ccw = polygonArea(tile.polygon) > 0;
  const polygon = ccw ? tile.polygon : tile.polygon.slice().reverse();
  const local = ccw ? tile.local : tile.local.slice().reverse();

  const { min, max } = tile.localBounds;
  const width = max.x - min.x;
  const height = max.y - min.y;

  const positions = new Float32Array(polygon.length * 3);
  const normals = new Float32Array(polygon.length * 3);
  const uvs = new Float32Array(polygon.length * 2);
  polygon.forEach((point, i) => {
    const [wx, wy, wz] = boardToWorld(point, y);
    positions.set([wx, wy, wz], i * 3);
    normals.set([0, 1, 0], i * 3);
    const l = local[i];
    if (!l) throw new Error("local outline out of sync with polygon");
    uvs.set([(l.x - min.x) / width, (l.y - min.y) / height], i * 2);
  });

  const contour = polygon.map((p) => new Vector2(p.x, p.y));
  const triangles = ShapeUtils.triangulateShape(contour, []);
  const index = new Uint16Array(triangles.flat());

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
