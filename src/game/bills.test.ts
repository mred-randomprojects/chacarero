import { describe, expect, it } from "vitest";
import { billBreakdown, billTotal } from "./bills";

describe("billBreakdown", () => {
  it("always sums back to the amount", () => {
    for (const cash of [0, 10, 40, 450, 1_170, 8_850, 8_860, 34_340, 35_000, 123_450]) {
      expect(billTotal(billBreakdown(cash))).toBe(cash);
    }
  });

  it("drops anything below ten pesos and never goes negative", () => {
    expect(billTotal(billBreakdown(5))).toBe(0);
    expect(billTotal(billBreakdown(-100))).toBe(0);
    expect(billTotal(billBreakdown(1_235))).toBe(1_230);
  });

  it("spreads a starting wallet across denominations", () => {
    const bills = billBreakdown(35_000);
    expect(bills[10]).toBeGreaterThan(0);
    expect(bills[500]).toBeGreaterThan(0);
    expect(bills[5000]).toBeGreaterThan(0);
  });
});
