/**
 * The fixed grid every deed has a slot in: provinces as columns in board
 * order, their cities as rows (cheapest at row 0), then the routes and the
 * companies. The trade screen shows one player's holdings on it; the Catastro
 * shows everyone's. Same layout everywhere, so a deed is always found in the
 * same place.
 */
import type { Deed, DeedId, Province } from "../game";
import { DEEDS, PROVINCE_NAMES, camposOf } from "../game";

export interface Slot {
  readonly deed: Deed;
  readonly column: number;
  readonly row: number;
}

const PROVINCE_ORDER: readonly Province[] = ["jujuy", "misiones", "salta", "chubut", "mendoza", "rioNegro", "cordoba", "buenosAires"];

export const SLOTS: readonly Slot[] = (() => {
  const slots: Slot[] = [];
  let route = 0;
  let company = 0;
  for (const deed of DEEDS) {
    if (deed.kind === "campo") {
      const column = PROVINCE_ORDER.indexOf(deed.province);
      const siblings = camposOf(deed.province);
      const i = siblings.findIndex((c) => c.id === deed.id);
      // Two-city provinces skip the middle row so the dearest city always sits on top.
      const row = siblings.length === 2 ? (i === 0 ? 0 : 2) : i;
      slots.push({ deed, column, row });
    } else if (deed.kind === "ruta") slots.push({ deed, column: 8, row: route++ });
    else slots.push({ deed, column: 9, row: company++ });
  }
  return slots;
})();
export const GRID_COLUMNS = 10;
export const GRID_ROWS = 4;

/** Cities too long for a slot, by the name people use anyway. */
const SHORT_CITY: Partial<Record<DeedId, string>> = {
  puertoIguazu: "Iguazú",
  puertoMadryn: "Madryn",
  villaGeneralBelgrano: "V. G. Belgrano",
  carlosPaz: "Carlos Paz",
  areco: "Areco",
  marDelPlata: "Mardel",
};

/** What fits on a slot: the city (shortened if needed) or the bare name. */
export function shortName(deed: Deed): string {
  if (deed.kind === "campo") return SHORT_CITY[deed.id] ?? deed.city;
  return deed.name;
}

export function columnLabel(column: number): string {
  if (column === 8) return "Rutas";
  if (column === 9) return "Cías.";
  const province = PROVINCE_ORDER[column];
  return province ? PROVINCE_NAMES[province].replace("Buenos Aires", "Bs. As.") : "";
}
