import { describe, expect, it } from "vitest";
import { describeSquare, pesos } from "./describe";
import { SQUARES } from "./board";

describe("pesos", () => {
  it("formats with a dot as thousands separator and drops the sign", () => {
    expect(pesos(5000)).toBe("$5.000");
    expect(pesos(-2000)).toBe("$2.000");
    expect(pesos(40)).toBe("$40");
  });
});

describe("describeSquare", () => {
  it("has a non-empty description for every square", () => {
    for (const square of SQUARES) {
      expect(describeSquare(square).length).toBeGreaterThan(20);
    }
  });

  it("quotes the amount on money squares", () => {
    expect(describeSquare({ index: 4, kind: "impuesto", name: "x", amount: -5000 })).toContain("$5.000");
    expect(describeSquare({ index: 7, kind: "premio", name: "x", amount: 2500 })).toContain("$2.500");
    expect(describeSquare({ index: 0, kind: "salida", name: "x" })).toContain("$5.000");
  });
});
