/**
 * Core domain types for Chacarero.
 *
 * Everything here is plain data: the board is a fixed ring of 42 squares, 29
 * of which reference a deed (escritura) that can be bought, rented, built on
 * and mortgaged. Cards are stored with their literal text plus a structured
 * effect so the engine never has to parse Spanish.
 */

/** The eight provinces on the board, in board order (cheapest first). */
export type Province =
  | "formosa"
  | "rioNegro"
  | "salta"
  | "mendoza"
  | "santaFe"
  | "tucuman"
  | "cordoba"
  | "buenosAires";

/** A province is split into up to three zones; Río Negro and Tucumán only have two. */
export type Zone = "sur" | "centro" | "norte";

/** Stable identifiers for every purchasable deed. */
export type DeedId =
  | "formosa-sur"
  | "formosa-centro"
  | "formosa-norte"
  | "rioNegro-sur"
  | "rioNegro-norte"
  | "salta-sur"
  | "salta-centro"
  | "salta-norte"
  | "mendoza-sur"
  | "mendoza-centro"
  | "mendoza-norte"
  | "santaFe-sur"
  | "santaFe-centro"
  | "santaFe-norte"
  | "tucuman-sur"
  | "tucuman-norte"
  | "cordoba-sur"
  | "cordoba-centro"
  | "cordoba-norte"
  | "buenosAires-sur"
  | "buenosAires-centro"
  | "buenosAires-norte"
  | "fc-belgrano"
  | "fc-sanMartin"
  | "fc-mitre"
  | "fc-urquiza"
  | "petrolera"
  | "bodega"
  | "ingenio";

/** Rent schedule for a campo, indexed by what is built on it. */
export interface CampoRent {
  /** Bare land, no buildings. */
  readonly campo: number;
  /** Rent with 1, 2, 3 and 4 chacras respectively. */
  readonly chacras: readonly [number, number, number, number];
  /** Rent with an estancia (replaces the 4 chacras). */
  readonly estancia: number;
}

export interface CampoDeed {
  readonly kind: "campo";
  readonly id: DeedId;
  readonly province: Province;
  readonly zone: Zone;
  readonly price: number;
  /** Cash the bank lends against the deed (always half the price). */
  readonly mortgage: number;
  /** Cost of each chacra placed on this campo. */
  readonly chacraCost: number;
  /** Extra paid on top of the 4 chacras to upgrade to an estancia. */
  readonly estanciaCost: number;
  readonly rent: CampoRent;
}

export interface FerrocarrilDeed {
  readonly kind: "ferrocarril";
  readonly id: DeedId;
  readonly name: string;
  readonly price: number;
  readonly mortgage: number;
  /** Rent when the owner holds 1, 2, 3 or 4 railways. */
  readonly rentByCount: readonly [number, number, number, number];
}

export interface CompaniaDeed {
  readonly kind: "compania";
  readonly id: DeedId;
  readonly name: string;
  readonly price: number;
  readonly mortgage: number;
  /** Rent is the dice total times this, for 1, 2 or 3 companies owned. */
  readonly diceMultiplierByCount: readonly [number, number, number];
}

export type Deed = CampoDeed | FerrocarrilDeed | CompaniaDeed;

/** Every kind of square on the ring. */
export type SquareKind =
  | "salida"
  | "campo"
  | "ferrocarril"
  | "compania"
  | "suerte"
  | "destino"
  | "impuesto"
  | "premio"
  | "comisaria"
  | "descanso"
  | "libreEstacionamiento"
  | "marchePreso";

interface SquareBase {
  /** Position on the ring, 0 = Salida, increasing clockwise. */
  readonly index: number;
  /** Display name, as printed on the tile. */
  readonly name: string;
}

export interface DeedSquare extends SquareBase {
  readonly kind: "campo" | "ferrocarril" | "compania";
  readonly deedId: DeedId;
}

export interface MoneySquare extends SquareBase {
  readonly kind: "impuesto" | "premio";
  /** Positive = the bank pays you, negative = you pay the bank. */
  readonly amount: number;
}

export interface PlainSquare extends SquareBase {
  readonly kind:
    | "salida"
    | "suerte"
    | "destino"
    | "comisaria"
    | "descanso"
    | "libreEstacionamiento"
    | "marchePreso";
}

export type Square = DeedSquare | MoneySquare | PlainSquare;

export type Deck = "suerte" | "destino";

export type CardEffect =
  | { readonly type: "collect"; readonly amount: number }
  | { readonly type: "pay"; readonly amount: number }
  | { readonly type: "collectFromEachPlayer"; readonly amount: number }
  | {
      readonly type: "moveTo";
      readonly square: number;
      /** Whether passing Salida on the way pays the usual bonus. */
      readonly collectSalida: boolean;
    }
  | { readonly type: "moveBy"; readonly steps: number }
  | { readonly type: "goToJail" }
  | { readonly type: "getOutOfJail" }
  | {
      readonly type: "payPerBuilding";
      readonly perChacra: number;
      readonly perEstancia: number;
    }
  | { readonly type: "payOrDraw"; readonly amount: number; readonly deck: Deck };

export interface Card {
  readonly id: string;
  readonly deck: Deck;
  /** Text shown to the player, Spanish, as on the physical card. */
  readonly text: string;
  readonly effect: CardEffect;
}
