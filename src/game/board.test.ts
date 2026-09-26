import { describe, expect, it } from "vitest";
import { CORNER_INDICES, JAIL_INDEX, SQUARES, getSquare, isCorner, tranqueraCrossings } from "./board";
import { BOARD_SIZE } from "./constants";
import { DEEDS } from "./deeds";
import type { SquareKind } from "./types";

describe("SQUARES", () => {
  it("has 42 squares indexed in order", () => {
    expect(SQUARES).toHaveLength(BOARD_SIZE);
    SQUARES.forEach((square, i) => expect(square.index).toBe(i));
  });

  it("places the six special corners every seven squares", () => {
    const cornerKinds: SquareKind[] = ["tranquera", "premio", "destacamento", "siesta", "mateada", "enCana"];
    CORNER_INDICES.forEach((index, i) => {
      expect(SQUARES[index]?.kind).toBe(cornerKinds[i]);
      expect(isCorner(index)).toBe(true);
    });
    expect(SQUARES.filter((s) => isCorner(s.index))).toHaveLength(6);
  });

  it("has the expected mix of square kinds", () => {
    const count = (kind: SquareKind) => SQUARES.filter((s) => s.kind === kind).length;
    expect(count("campo")).toBe(22);
    expect(count("ruta")).toBe(4);
    expect(count("compania")).toBe(3);
    expect(count("suerte")).toBe(3);
    expect(count("yeta")).toBe(2);
    expect(count("impuesto")).toBe(2);
    expect(count("premio")).toBe(1);
  });

  it("references every deed exactly once, in deed order", () => {
    const referenced = SQUARES.flatMap((s) => (s.kind === "campo" || s.kind === "ruta" || s.kind === "compania" ? [s.deedId] : []));
    expect(referenced).toEqual(DEEDS.map((d) => d.id));
  });

  it("matches deed kinds to square kinds", () => {
    for (const square of SQUARES) {
      if (square.kind !== "campo" && square.kind !== "ruta" && square.kind !== "compania") continue;
      const deed = DEEDS.find((d) => d.id === square.deedId);
      expect(deed?.kind).toBe(square.kind);
    }
  });

  it("puts the Destacamento where ¡En cana! sends you", () => {
    expect(SQUARES[JAIL_INDEX]?.kind).toBe("destacamento");
  });
});

describe("getSquare", () => {
  it("wraps around the ring in both directions", () => {
    expect(getSquare(42).index).toBe(0);
    expect(getSquare(45).index).toBe(3);
    expect(getSquare(-1).index).toBe(41);
  });
});

describe("tranqueraCrossings", () => {
  it("counts passing or landing on the Tranquera", () => {
    expect(tranqueraCrossings(40, 2)).toBe(1);
    expect(tranqueraCrossings(40, 1)).toBe(0);
    expect(tranqueraCrossings(0, 5)).toBe(0);
    expect(tranqueraCrossings(41, 43)).toBe(2);
  });

  it("never pays for moving backwards", () => {
    expect(tranqueraCrossings(1, -3)).toBe(0);
  });
});
