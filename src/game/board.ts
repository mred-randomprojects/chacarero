import type { DeedId, Square } from "./types";
import { BOARD_SIZE } from "./constants";

/** Indices of the six corner squares; the ring has six sides of six tiles each. */
export const CORNER_INDICES = [0, 7, 14, 21, 28, 35] as const;
export const SQUARES_PER_SIDE = 7;

function deed(index: number, kind: "campo" | "ruta" | "compania", deedId: DeedId, name: string): Square {
  return { index, kind, deedId, name };
}

/**
 * The 42 squares of the ring, clockwise from the Tranquera. Corner squares are
 * every 7th index.
 */
export const SQUARES: readonly Square[] = [
  { index: 0, kind: "tranquera", name: "Tranquera" },
  deed(1, "campo", "tilcara", "Tilcara"),
  deed(2, "campo", "humahuaca", "Humahuaca"),
  deed(3, "campo", "purmamarca", "Purmamarca"),
  { index: 4, kind: "impuesto", name: "Retenciones", amount: -5_000 },
  deed(5, "campo", "posadas", "Posadas"),
  deed(6, "campo", "puertoIguazu", "Puerto Iguazú"),
  { index: 7, kind: "premio", name: "Cosecha récord", amount: 2_500 },
  deed(8, "compania", "tambo", "Tambo"),
  deed(9, "campo", "cachi", "Cachi"),
  { index: 10, kind: "suerte", name: "Suerte" },
  deed(11, "campo", "cafayate", "Cafayate"),
  deed(12, "ruta", "ruta9", "Ruta 9"),
  deed(13, "campo", "saltaCapital", "Salta"),
  { index: 14, kind: "destacamento", name: "Destacamento" },
  { index: 15, kind: "yeta", name: "Yeta" },
  deed(16, "compania", "frigorifico", "Frigorífico"),
  deed(17, "campo", "trelew", "Trelew"),
  deed(18, "ruta", "ruta3", "Ruta 3"),
  deed(19, "campo", "esquel", "Esquel"),
  deed(20, "campo", "puertoMadryn", "Puerto Madryn"),
  { index: 21, kind: "siesta", name: "Siesta" },
  deed(22, "ruta", "ruta7", "Ruta 7"),
  deed(23, "campo", "malargue", "Malargüe"),
  deed(24, "campo", "sanRafael", "San Rafael"),
  { index: 25, kind: "suerte", name: "Suerte" },
  deed(26, "campo", "mendozaCapital", "Mendoza"),
  deed(27, "ruta", "ruta40", "Ruta 40"),
  { index: 28, kind: "mateada", name: "Mateada" },
  deed(29, "campo", "elBolson", "El Bolsón"),
  deed(30, "campo", "bariloche", "Bariloche"),
  deed(31, "compania", "cerealera", "Cerealera"),
  deed(32, "campo", "villaGeneralBelgrano", "Villa General Belgrano"),
  deed(33, "campo", "carlosPaz", "Villa Carlos Paz"),
  deed(34, "campo", "cordobaCapital", "Córdoba"),
  { index: 35, kind: "enCana", name: "¡En cana!" },
  { index: 36, kind: "yeta", name: "Yeta" },
  deed(37, "campo", "areco", "San Antonio de Areco"),
  { index: 38, kind: "suerte", name: "Suerte" },
  deed(39, "campo", "tandil", "Tandil"),
  deed(40, "campo", "marDelPlata", "Mar del Plata"),
  { index: 41, kind: "impuesto", name: "Ingresos Brutos", amount: -2_000 },
];

/** Index of the Destacamento, where "¡En cana!" sends you. */
export const JAIL_INDEX = 14;

/**
 * Returns the square at a ring position, wrapping around so `getSquare(45)`
 * is square 3.
 */
export function getSquare(index: number): Square {
  const wrapped = ((index % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const square = SQUARES[wrapped];
  if (!square) throw new Error(`No square at ${index}`);
  return square;
}

/** Whether a square is one of the six ring corners. */
export function isCorner(index: number): boolean {
  return index % SQUARES_PER_SIDE === 0;
}

/**
 * Number of Tranquera crossings when moving forward `steps` from `from`.
 * Landing exactly on the Tranquera counts as a crossing (the bonus is paid either way).
 */
export function tranqueraCrossings(from: number, steps: number): number {
  if (steps <= 0) return 0;
  return Math.floor((from + steps) / BOARD_SIZE);
}
