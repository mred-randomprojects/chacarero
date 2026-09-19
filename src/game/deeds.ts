import type { CampoDeed, CompaniaDeed, Deed, DeedId, FerrocarrilDeed, Province, Zone } from "./types";

/**
 * Human-readable province names, with accents, as printed on the tiles.
 */
export const PROVINCE_NAMES: Readonly<Record<Province, string>> = {
  formosa: "Formosa",
  rioNegro: "Río Negro",
  salta: "Salta",
  mendoza: "Mendoza",
  santaFe: "Santa Fe",
  tucuman: "Tucumán",
  cordoba: "Córdoba",
  buenosAires: "Buenos Aires",
};

export const ZONE_NAMES: Readonly<Record<Zone, string>> = {
  sur: "Zona Sur",
  centro: "Zona Centro",
  norte: "Zona Norte",
};

/** Colour band printed on each campo tile, one per province. */
export const PROVINCE_COLORS: Readonly<Record<Province, string>> = {
  formosa: "#1f5fd6",
  rioNegro: "#7cc242",
  salta: "#f2d21c",
  mendoza: "#8e3fb0",
  santaFe: "#1f9a3c",
  tucuman: "#f28c1c",
  cordoba: "#2ab7e8",
  buenosAires: "#d6231f",
};

/**
 * Builds a campo deed. Mortgage is always half the purchase price and the
 * estancia upgrade costs the same as one chacra (see docs/FUENTES.md for the
 * caveat on that last number).
 */
function campo(
  province: Province,
  zone: Zone,
  price: number,
  chacraCost: number,
  rent: readonly [number, number, number, number, number, number],
): CampoDeed {
  const [bare, c1, c2, c3, c4, estancia] = rent;
  return {
    kind: "campo",
    id: `${province}-${zone}` as DeedId,
    province,
    zone,
    price,
    mortgage: price / 2,
    chacraCost,
    estanciaCost: chacraCost,
    rent: { campo: bare, chacras: [c1, c2, c3, c4], estancia },
  };
}

function ferrocarril(id: DeedId, name: string): FerrocarrilDeed {
  return {
    kind: "ferrocarril",
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
  campo("formosa", "sur", 1_000, 1_000, [40, 200, 600, 1_700, 3_000, 4_750]),
  campo("formosa", "centro", 1_000, 1_000, [40, 200, 600, 1_700, 3_000, 4_750]),
  campo("formosa", "norte", 1_200, 1_000, [80, 400, 800, 3_400, 6_000, 9_500]),
  campo("rioNegro", "sur", 2_000, 1_000, [110, 570, 1_700, 5_150, 7_600, 9_500]),
  campo("rioNegro", "norte", 2_200, 1_000, [150, 750, 2_000, 5_700, 8_500, 11_500]),
  compania("petrolera", "Compañía Petrolera"),
  campo("salta", "sur", 2_600, 1_500, [200, 1_000, 2_800, 8_500, 12_000, 14_200]),
  campo("salta", "centro", 2_600, 1_500, [200, 1_000, 2_800, 8_500, 12_000, 14_200]),
  ferrocarril("fc-belgrano", "Ferrocarril General Belgrano"),
  campo("salta", "norte", 3_000, 1_500, [230, 1_150, 3_400, 9_500, 13_000, 17_000]),
  compania("bodega", "Bodega"),
  campo("mendoza", "sur", 3_400, 2_000, [250, 1_350, 3_800, 10_500, 14_200, 18_000]),
  ferrocarril("fc-sanMartin", "Ferrocarril General San Martín"),
  campo("mendoza", "centro", 3_400, 2_000, [250, 1_350, 3_800, 10_500, 14_200, 18_000]),
  campo("mendoza", "norte", 3_800, 2_000, [300, 1_500, 4_200, 11_500, 15_000, 19_000]),
  ferrocarril("fc-mitre", "Ferrocarril General Bartolomé Mitre"),
  campo("santaFe", "sur", 4_200, 2_500, [350, 1_700, 4_750, 13_000, 16_000, 20_000]),
  campo("santaFe", "centro", 4_200, 2_500, [350, 1_700, 4_750, 13_000, 16_000, 20_000]),
  campo("santaFe", "norte", 4_600, 2_500, [400, 2_000, 5_750, 14_000, 17_000, 21_000]),
  ferrocarril("fc-urquiza", "Ferrocarril General Urquiza"),
  campo("tucuman", "sur", 5_000, 3_000, [400, 2_200, 6_000, 15_000, 18_000, 21_000]),
  campo("tucuman", "norte", 5_400, 3_000, [450, 2_400, 6_800, 16_000, 19_500, 23_000]),
  compania("ingenio", "Ingenio"),
  campo("cordoba", "sur", 6_000, 3_000, [500, 2_500, 6_500, 17_000, 21_000, 24_000]),
  campo("cordoba", "centro", 6_000, 3_000, [450, 2_400, 6_800, 16_000, 19_500, 23_000]),
  campo("cordoba", "norte", 6_400, 3_000, [550, 2_850, 8_500, 19_000, 23_000, 27_000]),
  campo("buenosAires", "sur", 7_000, 4_000, [650, 3_300, 9_500, 22_000, 25_000, 30_000]),
  campo("buenosAires", "centro", 7_000, 4_000, [650, 3_300, 9_500, 22_000, 25_000, 30_000]),
  campo("buenosAires", "norte", 7_400, 4_000, [1_000, 4_000, 12_000, 26_000, 31_000, 36_000]),
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

/** Display name of a deed, e.g. "Formosa · Zona Sur" or "Bodega". */
export function deedName(deed: Deed): string {
  return deed.kind === "campo"
    ? `${PROVINCE_NAMES[deed.province]} · ${ZONE_NAMES[deed.zone]}`
    : deed.name;
}

/** All campos belonging to a province, in board order. */
export function camposOf(province: Province): readonly CampoDeed[] {
  return DEEDS.filter((deed): deed is CampoDeed => deed.kind === "campo" && deed.province === province);
}
