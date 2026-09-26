import type { CampoDeed, CompaniaDeed, Deed, DeedId, Province, RutaDeed } from "./types";

/**
 * Human-readable province names, with accents, as printed on the tiles.
 */
export const PROVINCE_NAMES: Readonly<Record<Province, string>> = {
  jujuy: "Jujuy",
  misiones: "Misiones",
  salta: "Salta",
  chubut: "Chubut",
  mendoza: "Mendoza",
  rioNegro: "Río Negro",
  cordoba: "Córdoba",
  buenosAires: "Buenos Aires",
};

/** Colour band printed on each campo tile, one per province. */
export const PROVINCE_COLORS: Readonly<Record<Province, string>> = {
  jujuy: "#e0672c",
  misiones: "#2f8f4e",
  salta: "#c23b3b",
  chubut: "#2d62a8",
  mendoza: "#6d2b73",
  rioNegro: "#4fb3c8",
  cordoba: "#d9a81e",
  buenosAires: "#e04f8f",
};

/**
 * Builds a campo deed. Mortgage is always half the purchase price and the
 * estancia upgrade costs the same as one chacra (see docs/FUENTES.md for the
 * caveat on that last number).
 */
function campo(
  id: DeedId,
  province: Province,
  city: string,
  price: number,
  chacraCost: number,
  rent: readonly [number, number, number, number, number, number],
): CampoDeed {
  const [bare, c1, c2, c3, c4, estancia] = rent;
  return {
    kind: "campo",
    id,
    province,
    city,
    price,
    mortgage: price / 2,
    chacraCost,
    estanciaCost: chacraCost,
    rent: { campo: bare, chacras: [c1, c2, c3, c4], estancia },
  };
}

function ruta(id: DeedId, name: string): RutaDeed {
  return {
    kind: "ruta",
    id,
    name,
    price: 3_600,
    mortgage: 1_800,
    rentByCount: [500, 1_000, 2_000, 4_000],
  };
}

function compania(id: DeedId, name: string): CompaniaDeed {
  return {
    kind: "compania",
    id,
    name,
    price: 3_800,
    mortgage: 1_900,
    diceMultiplierByCount: [100, 200, 300],
  };
}

/**
 * All 29 deeds, in board order. Rent columns are:
 * bare campo, 1 chacra, 2 chacras, 3 chacras, 4 chacras, estancia.
 */
export const DEEDS: readonly Deed[] = [
  campo("tilcara", "jujuy", "Tilcara", 1_000, 1_000, [40, 200, 600, 1_700, 3_000, 4_750]),
  campo("humahuaca", "jujuy", "Humahuaca", 1_000, 1_000, [40, 200, 600, 1_700, 3_000, 4_750]),
  campo("purmamarca", "jujuy", "Purmamarca", 1_200, 1_000, [80, 400, 800, 3_400, 6_000, 9_500]),
  campo("posadas", "misiones", "Posadas", 2_000, 1_000, [110, 570, 1_700, 5_150, 7_600, 9_500]),
  campo("puertoIguazu", "misiones", "Puerto Iguazú", 2_200, 1_000, [150, 750, 2_000, 5_700, 8_500, 11_500]),
  compania("tambo", "Tambo"),
  campo("cachi", "salta", "Cachi", 2_600, 1_500, [200, 1_000, 2_800, 8_500, 12_000, 14_200]),
  campo("cafayate", "salta", "Cafayate", 2_600, 1_500, [200, 1_000, 2_800, 8_500, 12_000, 14_200]),
  ruta("ruta9", "Ruta 9"),
  campo("saltaCapital", "salta", "Salta", 3_000, 1_500, [230, 1_150, 3_400, 9_500, 13_000, 17_000]),
  compania("frigorifico", "Frigorífico"),
  campo("trelew", "chubut", "Trelew", 3_400, 2_000, [250, 1_350, 3_800, 10_500, 14_200, 18_000]),
  ruta("ruta3", "Ruta 3"),
  campo("esquel", "chubut", "Esquel", 3_400, 2_000, [250, 1_350, 3_800, 10_500, 14_200, 18_000]),
  campo("puertoMadryn", "chubut", "Puerto Madryn", 3_800, 2_000, [300, 1_500, 4_200, 11_500, 15_000, 19_000]),
  ruta("ruta7", "Ruta 7"),
  campo("malargue", "mendoza", "Malargüe", 4_200, 2_500, [350, 1_700, 4_750, 13_000, 16_000, 20_000]),
  campo("sanRafael", "mendoza", "San Rafael", 4_200, 2_500, [350, 1_700, 4_750, 13_000, 16_000, 20_000]),
  campo("mendozaCapital", "mendoza", "Mendoza", 4_600, 2_500, [400, 2_000, 5_750, 14_000, 17_000, 21_000]),
  ruta("ruta40", "Ruta 40"),
  campo("elBolson", "rioNegro", "El Bolsón", 5_000, 3_000, [400, 2_200, 6_000, 15_000, 18_000, 21_000]),
  campo("bariloche", "rioNegro", "Bariloche", 5_400, 3_000, [450, 2_400, 6_800, 16_000, 19_500, 23_000]),
  compania("cerealera", "Cerealera"),
  campo("villaGeneralBelgrano", "cordoba", "Villa General Belgrano", 6_000, 3_000, [500, 2_500, 6_500, 17_000, 21_000, 24_000]),
  campo("carlosPaz", "cordoba", "Villa Carlos Paz", 6_000, 3_000, [450, 2_400, 6_800, 16_000, 19_500, 23_000]),
  campo("cordobaCapital", "cordoba", "Córdoba", 6_400, 3_000, [550, 2_850, 8_500, 19_000, 23_000, 27_000]),
  campo("areco", "buenosAires", "San Antonio de Areco", 7_000, 4_000, [650, 3_300, 9_500, 22_000, 25_000, 30_000]),
  campo("tandil", "buenosAires", "Tandil", 7_000, 4_000, [650, 3_300, 9_500, 22_000, 25_000, 30_000]),
  campo("marDelPlata", "buenosAires", "Mar del Plata", 7_400, 4_000, [1_000, 4_000, 12_000, 26_000, 31_000, 36_000]),
];

const DEEDS_BY_ID: ReadonlyMap<DeedId, Deed> = new Map(DEEDS.map((deed) => [deed.id, deed]));

/**
 * Looks up a deed by id.
 *
 * @throws if the id is unknown; ids are a closed union so this only happens on
 *   a programming error.
 */
export function getDeed(id: DeedId): Deed {
  const deed = DEEDS_BY_ID.get(id);
  if (!deed) throw new Error(`Unknown deed: ${id}`);
  return deed;
}

/** Display name of a deed, e.g. "Bariloche" or "Ruta 40". */
export function deedName(deed: Deed): string {
  return deed.kind === "campo" ? deed.city : deed.name;
}

/** All campos belonging to a province, in board order. */
export function camposOf(province: Province): readonly CampoDeed[] {
  return DEEDS.filter((deed): deed is CampoDeed => deed.kind === "campo" && deed.province === province);
}
