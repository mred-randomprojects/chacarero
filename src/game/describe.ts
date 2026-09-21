import { JAIL_BAIL, MAX_JAIL_TURNS, SALIDA_BONUS } from "./constants";
import { deedName, getDeed } from "./deeds";
import type { TradeOffer } from "./engine/state";
import type { Deed, Square } from "./types";

/** Formats an amount the way the cards do: "$5.000". */
export function pesos(amount: number): string {
  return `$${Math.abs(amount).toLocaleString("es-AR")}`;
}

/**
 * One-paragraph explanation of what happens when a player lands on a square,
 * in the second person, Rioplatense Spanish. Deed squares are described by
 * kind; the rent table is shown separately.
 */
export function describeSquare(square: Square): string {
  switch (square.kind) {
    case "salida":
      return `Cada vez que pasás o caés acá el Banco te paga ${pesos(SALIDA_BONUS)}.`;
    case "campo":
      return "Si nadie lo compró, podés comprárselo al Banco. Si tiene dueño, le pagás el alquiler que marca la escritura.";
    case "ferrocarril":
      return "Se compra como cualquier campo. El alquiler sube con cada ferrocarril que tenga el mismo dueño.";
    case "compania":
      return "Se compra como cualquier campo. El alquiler es lo que marcan los dados multiplicado por 100, 200 o 300 según cuántas compañías tenga el dueño.";
    case "suerte":
      return "Levantá la primera tarjeta del mazo de Suerte y hacé lo que dice.";
    case "destino":
      return "Levantá la primera tarjeta del mazo de Destino y hacé lo que dice.";
    case "impuesto":
      return `Le pagás ${pesos(square.amount)} al Banco.`;
    case "premio":
      return `El Banco te paga ${pesos(square.amount)}. Reclamalo antes de que tiren los dados otra vez o lo perdés.`;
    case "comisaria":
      return `Si caés acá de visita no pasa nada. Si estás preso, salís pagando ${pesos(JAIL_BAIL)}, sacando doble, usando una tarjeta o después de ${MAX_JAIL_TURNS} turnos.`;
    case "descanso":
      return "Podés quedarte hasta tres turnos sin tirar, siempre que avises antes de tirar los dados.";
    case "libreEstacionamiento":
      return "No pasa nada. Al turno siguiente seguís normalmente.";
    case "marchePreso":
      return "Vas directo a la Comisaría sin pasar por la Salida. Mientras estés preso no cobrás alquileres.";
  }
}

/**
 * The explanation printed on a railway or company deed, as on the physical
 * card, built from the deed's own numbers so the two can never disagree.
 * Campos need none: their card is the rent ladder itself.
 */
export function deedText(deed: Deed): string | null {
  if (deed.kind === "ferrocarril") {
    const [one, two, three, four] = deed.rentByCount;
    return `Alquiler ${pesos(one)}. Si el dueño tiene 2 ferrocarriles, ${pesos(two)}; con 3, ${pesos(three)}; con los 4, ${pesos(four)}.`;
  }
  if (deed.kind === "compania") {
    const [one, two, three] = deed.diceMultiplierByCount;
    return `Si el dueño tiene una sola compañía, el alquiler es ${one} veces lo que marcan los dados. Con 2 compañías, ${two} veces. Con las 3, ${three} veces.`;
  }
  return null;
}

/** One side of a trade in words: "Formosa Sur, Salta Norte y $2.000", or "nada". */
export function describeOffer(offer: TradeOffer): string {
  const items = offer.deeds.map((id) => deedName(getDeed(id)));
  if (offer.cash > 0) items.push(pesos(offer.cash));
  if (items.length === 0) return "nada";
  if (items.length === 1) return items[0] ?? "nada";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
