import { describe, expect, it } from "vitest";
import { DEEDS, PROVINCE_COLORS, PROVINCE_NAMES, camposOf, deedName, getDeed } from "./deeds";
import type { CampoDeed, Province } from "./types";

const campos = DEEDS.filter((d): d is CampoDeed => d.kind === "campo");

describe("DEEDS", () => {
  it("has 29 deeds with unique ids", () => {
    expect(DEEDS).toHaveLength(29);
    expect(new Set(DEEDS.map((d) => d.id)).size).toBe(29);
  });

  it("mortgages every deed at half its price", () => {
    for (const deed of DEEDS) expect(deed.mortgage).toBe(deed.price / 2);
  });

  it("gives Misiones and Río Negro two cities and every other province three", () => {
    const provinces = Object.keys(PROVINCE_NAMES) as Province[];
    for (const province of provinces) {
      const cities = camposOf(province).length;
      expect(cities).toBe(province === "misiones" || province === "rioNegro" ? 2 : 3);
      expect(PROVINCE_COLORS[province]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("gives every campo its own city", () => {
    expect(new Set(campos.map((c) => c.city)).size).toBe(campos.length);
  });

  it("orders provinces from cheapest to dearest", () => {
    let last = 0;
    for (const campo of campos) {
      expect(campo.price).toBeGreaterThanOrEqual(last);
      last = campo.price;
    }
  });

  it("charges more rent for every extra building", () => {
    for (const campo of campos) {
      const ladder = [campo.rent.campo, ...campo.rent.chacras, campo.rent.estancia];
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i]).toBeGreaterThan(ladder[i - 1] ?? Infinity);
      }
    }
  });

  it("keeps the last city the dearest of each province", () => {
    for (const province of Object.keys(PROVINCE_NAMES) as Province[]) {
      const cities = camposOf(province);
      const last = cities[cities.length - 1];
      for (const city of cities) expect(last?.price).toBeGreaterThanOrEqual(city.price);
    }
  });

  it("prices routes and companies uniformly", () => {
    for (const deed of DEEDS) {
      if (deed.kind === "ruta") {
        expect(deed.price).toBe(3_600);
        expect(deed.rentByCount).toEqual([500, 1_000, 2_000, 4_000]);
      }
      if (deed.kind === "compania") {
        expect(deed.price).toBe(3_800);
        expect(deed.diceMultiplierByCount).toEqual([100, 200, 300]);
      }
    }
  });
});

describe("getDeed / deedName", () => {
  it("finds deeds by id and formats their names", () => {
    expect(deedName(getDeed("tilcara"))).toBe("Tilcara");
    expect(deedName(getDeed("ruta7"))).toBe("Ruta 7");
    expect(deedName(getDeed("frigorifico"))).toBe("Frigorífico");
  });
});
