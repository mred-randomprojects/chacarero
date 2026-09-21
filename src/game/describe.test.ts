import { describe, expect, it } from "vitest";
import { deedText, describeSquare, pesos } from "./describe";
import { SQUARES } from "./board";
import { DEEDS, getDeed } from "./deeds";

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

describe("deedText", () => {
  it("spells out the railway and company rents with the deed's own numbers, and nothing for campos", () => {
    const railway = deedText(getDeed("fc-belgrano"));
    expect(railway).toContain("$500");
    expect(railway).toContain("$1.000");
    expect(railway).toContain("$2.000");
    expect(railway).toContain("$4.000");
    const company = deedText(getDeed("petrolera"));
    expect(company).toContain("100 veces");
    expect(company).toContain("200 veces");
    expect(company).toContain("300 veces");
    expect(company).toContain("dados");
    for (const deed of DEEDS) expect(deedText(deed) === null).toBe(deed.kind === "campo");
  });
});
