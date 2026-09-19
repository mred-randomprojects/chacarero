import type { DeedId, Square } from "./types";
import { BOARD_SIZE } from "./constants";

/** Indices of the six corner squares; the ring has six sides of six tiles each. */
export const CORNER_INDICES = [0, 7, 14, 21, 28, 35] as const;
export const SQUARES_PER_SIDE = 7;

function deed(index: number, kind: "campo" | "ferrocarril" | "compania", deedId: DeedId, name: string): Square {
  return { index, kind, deedId, name };
}

/**
 * The 42 squares of the ring, clockwise from Salida. Corner squares are every
 * 7th index. Numbering matches the digits printed on the physical board.
 */
export const SQUARES: readonly Square[] = [
  { index: 0, kind: "salida", name: "Salida" },
  deed(1, "campo", "formosa-sur", "Formosa · Zona Sur"),
  deed(2, "campo", "formosa-centro", "Formosa · Zona Centro"),
  deed(3, "campo", "formosa-norte", "Formosa · Zona Norte"),
  { index: 4, kind: "impuesto", name: "Impuesto a los réditos", amount: -5_000 },
  deed(5, "campo", "rioNegro-sur", "Río Negro · Zona Sur"),
  deed(6, "campo", "rioNegro-norte", "Río Negro · Zona Norte"),
  { index: 7, kind: "premio", name: "Premio ganadero", amount: 2_500 },
  deed(8, "compania", "petrolera", "Compañía Petrolera"),
  deed(9, "campo", "salta-sur", "Salta · Zona Sur"),
  { index: 10, kind: "destino", name: "Destino" },
  deed(11, "campo", "salta-centro", "Salta · Zona Centro"),
  deed(12, "ferrocarril", "fc-belgrano", "F.C. General Belgrano"),
  deed(13, "campo", "salta-norte", "Salta · Zona Norte"),
  { index: 14, kind: "comisaria", name: "Comisaría" },
  { index: 15, kind: "suerte", name: "Suerte" },
  deed(16, "compania", "bodega", "Bodega"),
  deed(17, "campo", "mendoza-sur", "Mendoza · Zona Sur"),
  deed(18, "ferrocarril", "fc-sanMartin", "F.C. General San Martín"),
  deed(19, "campo", "mendoza-centro", "Mendoza · Zona Centro"),
  deed(20, "campo", "mendoza-norte", "Mendoza · Zona Norte"),
  { index: 21, kind: "descanso", name: "Descanso" },
  deed(22, "ferrocarril", "fc-mitre", "F.C. General B. Mitre"),
  deed(23, "campo", "santaFe-sur", "Santa Fe · Zona Sur"),
  deed(24, "campo", "santaFe-centro", "Santa Fe · Zona Centro"),
  { index: 25, kind: "destino", name: "Destino" },
  deed(26, "campo", "santaFe-norte", "Santa Fe · Zona Norte"),
  deed(27, "ferrocarril", "fc-urquiza", "F.C. General Urquiza"),
  { index: 28, kind: "libreEstacionamiento", name: "Libre estacionamiento" },
  deed(29, "campo", "tucuman-sur", "Tucumán · Zona Sur"),
  deed(30, "campo", "tucuman-norte", "Tucumán · Zona Norte"),
  deed(31, "compania", "ingenio", "Ingenio"),
  deed(32, "campo", "cordoba-sur", "Córdoba · Zona Sur"),
  deed(33, "campo", "cordoba-centro", "Córdoba · Zona Centro"),
  deed(34, "campo", "cordoba-norte", "Córdoba · Zona Norte"),
  { index: 35, kind: "marchePreso", name: "Marche preso" },
  { index: 36, kind: "suerte", name: "Suerte" },
  deed(37, "campo", "buenosAires-sur", "Buenos Aires · Zona Sur"),
  { index: 38, kind: "destino", name: "Destino" },
  deed(39, "campo", "buenosAires-centro", "Buenos Aires · Zona Centro"),
  deed(40, "campo", "buenosAires-norte", "Buenos Aires · Zona Norte"),
  { index: 41, kind: "impuesto", name: "Impuesto a las ventas", amount: -2_000 },
];

/** Index of the Comisaría, where "Marche preso" sends you. */
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
 * Number of Salida crossings when moving forward `steps` from `from`.
 * Landing exactly on Salida counts as a crossing (the bonus is paid either way).
 */
export function salidaCrossings(from: number, steps: number): number {
  if (steps <= 0) return 0;
  return Math.floor((from + steps) / BOARD_SIZE);
}
