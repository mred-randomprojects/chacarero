/**
 * Pure geometry for the hexagonal board ring.
 *
 * The board is a regular hexagon with a vertex pointing left and right (flat
 * top and bottom). Salida sits on the bottom-right corner and the 42 squares
 * run clockwise: six squares along each side, one at each of the six corners.
 *
 * Coordinates are 2D board coordinates with +y pointing "up" when the board is
 * viewed from above with Salida at the bottom-right. The scene maps them onto
 * the XZ plane (see Board.tsx).
 */

import { BOARD_SIZE, SQUARES_PER_SIDE } from "../game";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly min: Vec2;
  readonly max: Vec2;
}

export interface TileLayout {
  readonly index: number;
  readonly isCorner: boolean;
  /** Which of the six sides this tile sits on (corner tiles report the side they start). */
  readonly side: number;
  /** Outline in board coordinates. */
  readonly polygon: readonly Vec2[];
  /** Area centroid in board coordinates. */
  readonly center: Vec2;
  /** Unit vector pointing to the board centre: the reader's "up" for tile text. */
  readonly up: Vec2;
  /** Unit vector pointing to the reader's right. */
  readonly right: Vec2;
  /** Outline in the tile's own (right, up) frame, centred on `center`. */
  readonly local: readonly Vec2[];
  readonly localBounds: Bounds;
}

export interface HexLayoutOptions {
  /** Circumradius of the inner hexagon (edge of the playing tiles facing the centre). */
  readonly innerRadius: number;
  /** How far each tile extends outwards from the inner hexagon. */
  readonly tileDepth: number;
  /** Extra width a corner tile takes from each adjacent side. */
  readonly cornerExtension: number;
}

export interface HexLayout {
  readonly options: HexLayoutOptions;
  readonly tiles: readonly TileLayout[];
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** Width of a regular side tile along its edge. */
  readonly tileWidth: number;
  readonly innerHexagon: readonly Vec2[];
  readonly outerHexagon: readonly Vec2[];
}

const SIDES = 6;
const TILES_PER_SIDE = SQUARES_PER_SIDE - 1;

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function scale(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}
function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}
function normalize(a: Vec2): Vec2 {
  const len = length(a);
  if (len === 0) throw new Error("Cannot normalize a zero vector");
  return scale(a, 1 / len);
}
/** Rotates a unit vector 90° counter-clockwise. */
function perpLeft(a: Vec2): Vec2 {
  return { x: -a.y, y: a.x };
}

/** Vertices of a regular hexagon, clockwise from the bottom-right corner. */
export function hexagonVertices(radius: number): Vec2[] {
  const vertices: Vec2[] = [];
  for (let k = 0; k < SIDES; k++) {
    const angle = (-60 - 60 * k) * (Math.PI / 180);
    vertices.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return vertices;
}

/** Signed area (positive when counter-clockwise). */
export function polygonArea(polygon: readonly Vec2[]): number {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (a && b) twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

/** Area centroid of a simple polygon. */
export function polygonCentroid(polygon: readonly Vec2[]): Vec2 {
  const area = polygonArea(polygon);
  if (area === 0) throw new Error("Degenerate polygon");
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (!a || !b) continue;
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function toLocal(polygon: readonly Vec2[], center: Vec2, right: Vec2, up: Vec2): { local: Vec2[]; bounds: Bounds } {
  const local = polygon.map((p) => {
    const d = sub(p, center);
    return { x: dot(d, right), y: dot(d, up) };
  });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of local) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { local, bounds: { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } };
}

function makeTile(index: number, isCorner: boolean, side: number, polygon: Vec2[], up: Vec2): TileLayout {
  const right = { x: up.y, y: -up.x };
  const center = polygonCentroid(polygon);
  const { local, bounds } = toLocal(polygon, center, right, up);
  return { index, isCorner, side, polygon, center, up, right, local, localBounds: bounds };
}

/**
 * Computes the outline of every tile on the ring.
 *
 * Side `k` runs from corner `k` to corner `k+1`; along its inner edge the first
 * `cornerExtension` belongs to corner `k`, then six tiles of equal width, then
 * `cornerExtension` for corner `k+1`. A corner tile is the kite at the vertex
 * plus those two extensions, giving it the familiar six-sided shape.
 */
export function computeHexLayout(options: HexLayoutOptions): HexLayout {
  const { innerRadius, tileDepth, cornerExtension } = options;
  if (innerRadius <= 0 || tileDepth <= 0 || cornerExtension < 0) {
    throw new Error("Hex layout dimensions must be positive");
  }
  const tileWidth = (innerRadius - 2 * cornerExtension) / TILES_PER_SIDE;
  if (tileWidth <= 0) throw new Error("Corner extension leaves no room for side tiles");

  const outerRadius = innerRadius + (2 * tileDepth) / Math.sqrt(3);
  const inner = hexagonVertices(innerRadius);
  const outer = hexagonVertices(outerRadius);

  const tangents: Vec2[] = [];
  const normals: Vec2[] = [];
  for (let k = 0; k < SIDES; k++) {
    const from = inner[k];
    const to = inner[(k + 1) % SIDES];
    if (!from || !to) throw new Error("unreachable");
    const t = normalize(sub(to, from));
    tangents.push(t);
    normals.push(perpLeft(t));
  }

  const tiles: TileLayout[] = [];
  for (let k = 0; k < SIDES; k++) {
    const vertex = inner[k];
    const outerVertex = outer[k];
    const t = tangents[k];
    const n = normals[k];
    const prev = (k + SIDES - 1) % SIDES;
    const tPrev = tangents[prev];
    const nPrev = normals[prev];
    if (!vertex || !outerVertex || !t || !n || !tPrev || !nPrev) throw new Error("unreachable");

    const cornerPolygon: Vec2[] = [
      vertex,
      add(vertex, scale(t, cornerExtension)),
      add(add(vertex, scale(t, cornerExtension)), scale(n, tileDepth)),
      outerVertex,
      add(sub(vertex, scale(tPrev, cornerExtension)), scale(nPrev, tileDepth)),
      sub(vertex, scale(tPrev, cornerExtension)),
    ];
    tiles.push(makeTile(k * SQUARES_PER_SIDE, true, k, cornerPolygon, normalize(scale(vertex, -1))));

    for (let i = 0; i < TILES_PER_SIDE; i++) {
      const a = add(vertex, scale(t, cornerExtension + i * tileWidth));
      const b = add(vertex, scale(t, cornerExtension + (i + 1) * tileWidth));
      const polygon: Vec2[] = [a, b, add(b, scale(n, tileDepth)), add(a, scale(n, tileDepth))];
      tiles.push(makeTile(k * SQUARES_PER_SIDE + 1 + i, false, k, polygon, scale(n, -1)));
    }
  }

  if (tiles.length !== BOARD_SIZE) throw new Error(`Expected ${BOARD_SIZE} tiles, built ${tiles.length}`);

  return {
    options,
    tiles,
    innerRadius,
    outerRadius,
    tileWidth,
    innerHexagon: inner,
    outerHexagon: outer,
  };
}

/** Board-space position for the pawn slot `slot` (0-5) on a tile, spread in a small grid. */
export function pawnPosition(tile: TileLayout, slot: number, spacing: number): Vec2 {
  const col = slot % 2;
  const row = Math.floor(slot / 2);
  const offsetRight = (col - 0.5) * spacing;
  const offsetUp = (row - 1) * spacing;
  return add(add(tile.center, scale(tile.right, offsetRight)), scale(tile.up, offsetUp));
}
