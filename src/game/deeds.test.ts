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

  it("gives Río Negro and Tucumán two zones and every other province three", () => {
    const provinces = Object.keys(PROVINCE_NAMES) as Province[];
    for (const province of provinces) {
      const zones = camposOf(province).map((c) => c.zone);
      if (province === "rioNegro" || province === "tucuman") {
        expect(zones).toEqual(["sur", "norte"]);
      } else {
        expect(zones).toEqual(["sur", "centro", "norte"]);
      }
      expect(PROVINCE_COLORS[province]).toMatch(/^#[0-9a-f]{6}$/);
    }
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

  it("keeps the zona norte the dearest of each province", () => {
    for (const province of Object.keys(PROVINCE_NAMES) as Province[]) {
      const zones = camposOf(province);
      const norte = zones.find((z) => z.zone === "norte");
      for (const zone of zones) expect(norte?.price).toBeGreaterThanOrEqual(zone.price);
    }
  });

  it("prices railways and companies uniformly", () => {
    for (const deed of DEEDS) {
      if (deed.kind === "ferrocarril") {
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
    expect(deedName(getDeed("formosa-sur"))).toBe("Formosa · Zona Sur");
    expect(deedName(getDeed("fc-mitre"))).toBe("Ferrocarril General Bartolomé Mitre");
    expect(deedName(getDeed("bodega"))).toBe("Bodega");
  });
});
