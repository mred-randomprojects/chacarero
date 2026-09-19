import { describe, expect, it } from "vitest";
import { computeHexLayout, hexagonVertices, polygonArea, polygonCentroid } from "./hexLayout";
import { BOARD_SIZE, CORNER_INDICES } from "../game";

const layout = computeHexLayout({ innerRadius: 10, tileDepth: 2.4, cornerExtension: 0.9 });

describe("hexagonVertices", () => {
  it("starts at the bottom-right corner and goes clockwise", () => {
    const [v0, v1, v2, v3, v4, v5] = hexagonVertices(2);
    expect(v0?.x).toBeCloseTo(1);
    expect(v0?.y).toBeCloseTo(-Math.sqrt(3));
    expect(v1?.x).toBeCloseTo(-1);
    expect(v1?.y).toBeCloseTo(-Math.sqrt(3));
    expect(v2?.x).toBeCloseTo(-2);
    expect(v2?.y).toBeCloseTo(0);
    expect(v3?.x).toBeCloseTo(-1);
    expect(v3?.y).toBeCloseTo(Math.sqrt(3));
    expect(v4?.x).toBeCloseTo(1);
    expect(v4?.y).toBeCloseTo(Math.sqrt(3));
    expect(v5?.x).toBeCloseTo(2);
    expect(v5?.y).toBeCloseTo(0);
  });
});

describe("computeHexLayout", () => {
  it("produces one tile per square, indexed in order", () => {
    expect(layout.tiles).toHaveLength(BOARD_SIZE);
    layout.tiles.forEach((tile, i) => expect(tile.index).toBe(i));
  });

  it("marks exactly the six corner squares as corners with six-sided outlines", () => {
    for (const tile of layout.tiles) {
      const expectedCorner = (CORNER_INDICES as readonly number[]).includes(tile.index);
      expect(tile.isCorner).toBe(expectedCorner);
      expect(tile.polygon).toHaveLength(expectedCorner ? 6 : 4);
    }
  });

  it("gives every tile a positive area and side tiles equal areas", () => {
    const sideAreas = layout.tiles.filter((t) => !t.isCorner).map((t) => Math.abs(polygonArea(t.polygon)));
    const first = sideAreas[0];
    expect(first).toBeGreaterThan(0);
    for (const area of sideAreas) expect(area).toBeCloseTo(first ?? 0, 6);
    for (const tile of layout.tiles.filter((t) => t.isCorner)) {
      expect(Math.abs(polygonArea(tile.polygon))).toBeGreaterThan(first ?? 0);
    }
  });

  it("tiles the whole ring without gaps or overlap", () => {
    const ringArea = Math.abs(polygonArea(layout.outerHexagon)) - Math.abs(polygonArea(layout.innerHexagon));
    const tilesArea = layout.tiles.reduce((sum, t) => sum + Math.abs(polygonArea(t.polygon)), 0);
    expect(tilesArea).toBeCloseTo(ringArea, 6);
  });

  it("puts Salida at the bottom-right and numbers squares clockwise", () => {
    const salida = layout.tiles[0];
    const formosaSur = layout.tiles[1];
    const premio = layout.tiles[7];
    const comisaria = layout.tiles[14];
    const descanso = layout.tiles[21];
    const libre = layout.tiles[28];
    const preso = layout.tiles[35];
    expect(salida?.center.x).toBeGreaterThan(0);
    expect(salida?.center.y).toBeLessThan(0);
    expect(formosaSur?.center.x).toBeLessThan(salida?.center.x ?? 0);
    expect(premio?.center.x).toBeLessThan(0);
    expect(premio?.center.y).toBeLessThan(0);
    expect(comisaria?.center.y).toBeCloseTo(0, 6);
    expect(comisaria?.center.x).toBeLessThan(0);
    expect(descanso?.center.y).toBeGreaterThan(0);
    expect(libre?.center.x).toBeGreaterThan(0);
    expect(libre?.center.y).toBeGreaterThan(0);
    expect(preso?.center.y).toBeCloseTo(0, 6);
    expect(preso?.center.x).toBeGreaterThan(0);
  });

  it("orients every tile's up vector towards the board centre", () => {
    for (const tile of layout.tiles) {
      const toCentre = { x: -tile.center.x, y: -tile.center.y };
      const dot = toCentre.x * tile.up.x + toCentre.y * tile.up.y;
      expect(dot).toBeGreaterThan(0);
      expect(Math.hypot(tile.up.x, tile.up.y)).toBeCloseTo(1, 9);
      expect(Math.hypot(tile.right.x, tile.right.y)).toBeCloseTo(1, 9);
      expect(tile.up.x * tile.right.x + tile.up.y * tile.right.y).toBeCloseTo(0, 9);
    }
  });

  it("centres local coordinates on the centroid", () => {
    for (const tile of layout.tiles) {
      const local = polygonCentroid(tile.local);
      expect(local.x).toBeCloseTo(0, 6);
      expect(local.y).toBeCloseTo(0, 6);
      expect(tile.localBounds.min.x).toBeLessThan(0);
      expect(tile.localBounds.max.x).toBeGreaterThan(0);
    }
  });

  it("keeps tile centres distinct", () => {
    const keys = new Set(layout.tiles.map((t) => `${t.center.x.toFixed(4)},${t.center.y.toFixed(4)}`));
    expect(keys.size).toBe(BOARD_SIZE);
  });

  it("rejects dimensions that leave no room for tiles", () => {
    expect(() => computeHexLayout({ innerRadius: 1, tileDepth: 1, cornerExtension: 0.6 })).toThrow();
    expect(() => computeHexLayout({ innerRadius: 0, tileDepth: 1, cornerExtension: 0 })).toThrow();
  });
});
