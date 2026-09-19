import type { Card, CardEffect, Deck } from "./types";

function card(deck: Deck, n: number, text: string, effect: CardEffect): Card {
  return { id: `${deck}-${String(n).padStart(2, "0")}`, deck, text, effect };
}

/**
 * The 16 Suerte cards. Ordering is arbitrary; the deck is shuffled at setup.
 * Square numbers refer to `SQUARES` in board.ts.
 */
export const SUERTE_CARDS: readonly Card[] = [
  card("suerte", 1, "Dese una vuelta hasta la Bodega. Si pasa por la Salida, cobre $5.000.", {
    type: "moveTo",
    square: 16,
    collectSalida: true,
  }),
  card("suerte", 2, "Hábeas corpus concedido: con esta tarjeta sale gratis de la Comisaría. Guárdela o véndala.", {
    type: "getOutOfJail",
  }),
  card("suerte", 3, "Ganó en las carreras. Cobre $3.000.", { type: "collect", amount: 3_000 }),
  card("suerte", 4, "Retroceda 3 casilleros.", { type: "moveBy", steps: -3 }),
  card("suerte", 5, "Compra de semillas: pague al Banco $800 por cada chacra y $4.000 por cada estancia.", {
    type: "payPerBuilding",
    perChacra: 800,
    perEstancia: 4_000,
  }),
  card("suerte", 6, "Multa por exceso de velocidad. Pague $300.", { type: "pay", amount: 300 }),
  card("suerte", 7, "Intereses bancarios a su favor. Cobre $1.000.", { type: "collect", amount: 1_000 }),
  card("suerte", 8, "Siga hasta Salta, Zona Norte. Si pasa por la Salida, cobre $5.000.", {
    type: "moveTo",
    square: 13,
    collectSalida: true,
  }),
  card("suerte", 9, "Multa caminera. Pague $400.", { type: "pay", amount: 400 }),
  card("suerte", 10, "Gastos de colegio. Pague $3.000.", { type: "pay", amount: 3_000 }),
  card("suerte", 11, "Siga hasta Santa Fe, Zona Norte. Si pasa por la Salida, cobre $5.000.", {
    type: "moveTo",
    square: 26,
    collectSalida: true,
  }),
  card("suerte", 12, "Siga hasta Buenos Aires, Zona Norte.", { type: "moveTo", square: 40, collectSalida: false }),
  card("suerte", 13, "Marche preso. Vaya directamente a la Comisaría sin pasar por la Salida.", { type: "goToJail" }),
  card("suerte", 14, "¡Sacó la grande! Cobre $10.000.", { type: "collect", amount: 10_000 }),
  card("suerte", 15, "Sus campos necesitan reparaciones: pague al Banco $500 por cada chacra y $2.500 por cada estancia.", {
    type: "payPerBuilding",
    perChacra: 500,
    perEstancia: 2_500,
  }),
  card("suerte", 16, "Siga hasta la Salida y cobre $5.000.", { type: "moveTo", square: 0, collectSalida: true }),
];

/** The 16 Destino cards. */
export const DESTINO_CARDS: readonly Card[] = [
  card("destino", 1, "Es su cumpleaños. Cobre $200 de cada jugador.", { type: "collectFromEachPlayer", amount: 200 }),
  card("destino", 2, "Ganó un concurso agrícola. Cobre $2.000.", { type: "collect", amount: 2_000 }),
  card("destino", 3, "Siga hasta la Salida y cobre $5.000.", { type: "moveTo", square: 0, collectSalida: true }),
  card("destino", 4, "Vuelva atrás hasta Formosa, Zona Sur.", { type: "moveTo", square: 1, collectSalida: false }),
  card("destino", 5, "Recibió una herencia. Cobre $2.000.", { type: "collect", amount: 2_000 }),
  card("destino", 6, "Pague $200 o levante una tarjeta de Suerte.", { type: "payOrDraw", amount: 200, deck: "suerte" }),
  card("destino", 7, "Devolución de impuestos. Cobre $400.", { type: "collect", amount: 400 }),
  card("destino", 8, "Vence su póliza de seguro. Pague $1.000.", { type: "pay", amount: 1_000 }),
  card("destino", 9, "Error de cálculo del Banco a su favor. Cobre $4.000.", { type: "collect", amount: 4_000 }),
  card("destino", 10, "Segundo premio en el concurso de belleza. Cobre $200.", { type: "collect", amount: 200 }),
  card("destino", 11, "Vendió acciones. Cobre $1.000.", { type: "collect", amount: 1_000 }),
  card("destino", 12, "Marche preso. Vaya directamente a la Comisaría sin pasar por la Salida.", { type: "goToJail" }),
  card("destino", 13, "Con esta tarjeta sale gratis de la Comisaría. Guárdela o véndala.", { type: "getOutOfJail" }),
  card("destino", 14, "Interés del 5% sobre cédulas hipotecarias. Cobre $500.", { type: "collect", amount: 500 }),
  card("destino", 15, "Gastos de farmacia. Pague $1.000.", { type: "pay", amount: 1_000 }),
  card("destino", 16, "Ganó otro concurso agrícola. Cobre $2.000.", { type: "collect", amount: 2_000 }),
];

export const ALL_CARDS: readonly Card[] = [...SUERTE_CARDS, ...DESTINO_CARDS];

/** Cards of one deck, in a fresh shuffled order (Fisher–Yates). */
export function shuffledDeck(deck: Deck, random: () => number = Math.random): Card[] {
  const cards = (deck === "suerte" ? SUERTE_CARDS : DESTINO_CARDS).slice();
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
