import type { Card, CardEffect, Deck } from "./types";

function card(deck: Deck, n: number, text: string, effect: CardEffect): Card {
  return { id: `${deck}-${String(n).padStart(2, "0")}`, deck, text, effect };
}

/**
 * The 16 Suerte cards: mostly good news (13), with three that are not.
 * Ordering is arbitrary; the deck is shuffled at setup. Square numbers refer
 * to `SQUARES` in board.ts.
 */
export const SUERTE_CARDS: readonly Card[] = [
  card("suerte", 1, "Tu compadre es el comisario: con esta tarjeta salís gratis del Destacamento. Guardala o vendela.", {
    type: "getOutOfJail",
  }),
  card("suerte", 2, "Tu caballo ganó por una cabeza. Cobrá $3.000.", { type: "collect", amount: 3_000 }),
  card("suerte", 3, "Venció tu plazo fijo. Cobrá $1.000.", { type: "collect", amount: 1_000 }),
  card("suerte", 4, "¡Sacaste la grande en la lotería! Cobrá $10.000.", { type: "collect", amount: 10_000 }),
  card("suerte", 5, "Te invitan a un asado en tu campo: volvé a la Tranquera y cobrá $5.000.", { type: "moveTo", square: 0, collectTranquera: true, direction: "forward" }),
  card("suerte", 6, "Es tu cumpleaños: cada jugador te regala $200.", { type: "collectFromEachPlayer", amount: 200 }),
  card("suerte", 7, "Tu toro salió Gran Campeón. Cobrá $2.000.", { type: "collect", amount: 2_000 }),
  card("suerte", 8, "Te llevan en la chata hasta la Tranquera. Cobrá $5.000.", {
    type: "moveTo",
    square: 0,
    collectTranquera: true,
    direction: "forward",
  }),
  card("suerte", 9, "Herencia de un tío que no conocías. Cobrá $2.000.", { type: "collect", amount: 2_000 }),
  card("suerte", 10, "El Banco se equivocó a tu favor. Cobrá $4.000.", { type: "collect", amount: 4_000 }),
  card("suerte", 11, "Vendiste la cosecha a buen precio. Cobrá $1.000.", { type: "collect", amount: 1_000 }),
  card("suerte", 12, "Llovió justo a tiempo y la cosecha rindió más. Cobrá $500.", { type: "collect", amount: 500 }),
  card("suerte", 13, "Ganaste el concurso de asado del pueblo. Cobrá $2.000.", { type: "collect", amount: 2_000 }),
  card("suerte", 14, "Te paró un control en la ruta y tenías la VTV vencida. Pagá $300 de multa.", { type: "pay", amount: 300 }),
  card("suerte", 15, "Salís de viaje a Salta. Si pasás por la Tranquera, cobrá $5.000.", {
    type: "moveTo",
    square: 13,
    collectTranquera: true,
    direction: "forward",
  }),
  card("suerte", 16, "Te vas de vacaciones a Mar del Plata.", { type: "moveTo", square: 40, collectTranquera: false, direction: "forward" }),
];

/** The 16 Yeta cards: mostly bad news (13), with three "¡zafaste!". */
export const YETA_CARDS: readonly Card[] = [
  card("yeta", 1, "Te toca llevar los novillos al Frigorífico. Si pasás por la Tranquera, cobrá $5.000.", {
    type: "moveTo",
    square: 16,
    collectTranquera: true,
    direction: "forward",
  }),
  card("yeta", 2, "Se inundó el camino y hay que dar la vuelta. Retrocedé 3 casilleros.", { type: "moveBy", steps: -3 }),
  card("yeta", 3, "Llegó el revalúo del inmobiliario rural: pagá $800 por cada chacra y $4.000 por cada estancia.", {
    type: "payPerBuilding",
    perChacra: 800,
    perEstancia: 4_000,
  }),
  card("yeta", 4, "Multa caminera. Pagá $400.", { type: "pay", amount: 400 }),
  card("yeta", 5, "Empiezan las clases: útiles y guardapolvos. Pagá $3.000.", { type: "pay", amount: 3_000 }),
  card("yeta", 6, "Te mandan a Mendoza por un trámite. Si pasás por la Tranquera, cobrá $5.000.", {
    type: "moveTo",
    square: 26,
    collectTranquera: true,
    direction: "forward",
  }),
  card("yeta", 7, "Averiguación de antecedentes: andá directo al Destacamento, sin pasar por la Tranquera.", { type: "goToJail" }),
  card("yeta", 8, "Cayó granizo y hay que arreglar los techos: pagá $500 por cada chacra y $2.500 por cada estancia.", {
    type: "payPerBuilding",
    perChacra: 500,
    perEstancia: 2_500,
  }),
  card("yeta", 9, "Te olvidaste el mate en Tilcara: volvé a buscarlo.", { type: "moveTo", square: 1, collectTranquera: false, direction: "backward" }),
  card("yeta", 10, "Te piden una colaboración para la fiesta del pueblo: pagá $200 o probá suerte y levantá una tarjeta de Suerte.", { type: "payOrDraw", amount: 200, deck: "suerte" }),
  card("yeta", 11, "Venció el seguro de la camioneta. Pagá $1.000.", { type: "pay", amount: 1_000 }),
  card("yeta", 12, "Te agarraron carneando una vaca ajena. ¡En cana! Andá directo al Destacamento, sin pasar por la Tranquera.", {
    type: "goToJail",
  }),
  card("yeta", 13, "Se rompió el tractor. Pagá $1.000 de arreglo.", { type: "pay", amount: 1_000 }),
  card("yeta", 14, "¡Zafaste! Un abogado amigo te saca del apuro: con esta tarjeta salís gratis del Destacamento. Guardala o vendela.", { type: "getOutOfJail" }),
  card("yeta", 15, "¡Zafaste! Te devolvieron un impuesto. Cobrá $400.", { type: "collect", amount: 400 }),
  card("yeta", 16, "¡Zafaste! La helada pasó de largo y salvaste la cosecha. Cobrá $200.", { type: "collect", amount: 200 }),
];

export const ALL_CARDS: readonly Card[] = [...SUERTE_CARDS, ...YETA_CARDS];

/** Cards of one deck, in a fresh shuffled order (Fisher–Yates). */
export function shuffledDeck(deck: Deck, random: () => number = Math.random): Card[] {
  const cards = (deck === "suerte" ? SUERTE_CARDS : YETA_CARDS).slice();
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = cards[i];
    const b = cards[j];
    if (a !== undefined && b !== undefined) {
      cards[i] = b;
      cards[j] = a;
    }
  }
  return cards;
}
