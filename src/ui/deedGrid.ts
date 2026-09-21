/**
 * The fixed grid every deed has a slot in: provinces as columns in board
 * order, zones as rows, then the railways and the companies. The trade
 * screen shows one player's holdings on it; the Catastro shows everyone's.
 * Same layout everywhere, so a deed is always found in the same place.
 */
import type { Deed } from "../game";
import { DEEDS, PROVINCE_NAMES, ZONE_NAMES } from "../game";

export interface Slot {
  readonly deed: Deed;
  readonly column: number;
  readonly row: number;
}

const PROVINCE_ORDER = ["formosa", "rioNegro", "salta", "mendoza", "santaFe", "tucuman", "cordoba", "buenosAires"] as const;
const ZONE_ROW = { sur: 0, centro: 1, norte: 2 } as const;

export const SLOTS: readonly Slot[] = (() => {
  const slots: Slot[] = [];
  let rail = 0;
  let company = 0;
  for (const deed of DEEDS) {
    if (deed.kind === "campo") {
      const column = PROVINCE_ORDER.indexOf(deed.province);
      // Two-zone provinces skip the middle row so "norte" always sits on top.
      const row = deed.province === "rioNegro" || deed.province === "tucuman" ? (deed.zone === "sur" ? 0 : 2) : ZONE_ROW[deed.zone];
      slots.push({ deed, column, row });
    } else if (deed.kind === "ferrocarril") slots.push({ deed, column: 8, row: rail++ });
    else slots.push({ deed, column: 9, row: company++ });
  }
  return slots;
})();
export const GRID_COLUMNS = 10;
export const GRID_ROWS = 4;

/** What fits on a slot: the zone for a campo, the bare name for the rest. */
export function shortName(deed: Deed): string {
  if (deed.kind === "campo") return ZONE_NAMES[deed.zone].replace("Zona ", "");
  return deed.name.replace(/^Ferrocarril General /, "").replace(/^Compañía /, "").replace("Bartolomé ", "B. ");
}

export function columnLabel(column: number): string {
  if (column === 8) return "FF.CC.";
  if (column === 9) return "Cías.";
  const province = PROVINCE_ORDER[column];
  return province ? PROVINCE_NAMES[province].replace("Buenos Aires", "Bs. As.") : "";
}
