/**
 * Core domain types for Terrateniente.
 *
 * Everything here is plain data: the board is a fixed ring of 42 squares, 29
 * of which reference a deed (escritura) that can be bought, rented, built on
 * and mortgaged. Cards are stored with their literal text plus a structured
 * effect so the engine never has to parse Spanish.
 */

/** The eight provinces on the board, in board order (cheapest first). */
export type Province =
  | "jujuy"
  | "misiones"
  | "salta"
  | "chubut"
  | "mendoza"
  | "rioNegro"
  | "cordoba"
  | "buenosAires";

/** Stable identifiers for every purchasable deed: one city per campo, then the routes and the companies. */
export type DeedId =
  | "tilcara"
  | "humahuaca"
  | "purmamarca"
  | "posadas"
  | "puertoIguazu"
  | "cachi"
  | "cafayate"
  | "saltaCapital"
  | "trelew"
  | "esquel"
  | "puertoMadryn"
  | "malargue"
  | "sanRafael"
  | "mendozaCapital"
  | "elBolson"
  | "bariloche"
  | "villaGeneralBelgrano"
  | "carlosPaz"
  | "cordobaCapital"
  | "areco"
  | "tandil"
  | "marDelPlata"
  | "ruta9"
  | "ruta3"
  | "ruta7"
  | "ruta40"
  | "tambo"
  | "frigorifico"
  | "cerealera";

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
  /** The city printed on the deed, e.g. "Bariloche". */
  readonly city: string;
  readonly price: number;
  /** Cash the bank lends against the deed (always half the price). */
  readonly mortgage: number;
  /** Cost of each chacra placed on this campo. */
  readonly chacraCost: number;
  /** Extra paid on top of the 4 chacras to upgrade to an estancia. */
  readonly estanciaCost: number;
  readonly rent: CampoRent;
}

export interface RutaDeed {
  readonly kind: "ruta";
  readonly id: DeedId;
  readonly name: string;
  readonly price: number;
  readonly mortgage: number;
  /** Rent when the owner holds 1, 2, 3 or 4 routes. */
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

export type Deed = CampoDeed | RutaDeed | CompaniaDeed;

/** Every kind of square on the ring. */
export type SquareKind =
  | "tranquera"
  | "campo"
  | "ruta"
  | "compania"
  | "suerte"
  | "yeta"
  | "impuesto"
  | "premio"
  | "destacamento"
  | "siesta"
  | "mateada"
  | "enCana";

interface SquareBase {
  /** Position on the ring, 0 = Tranquera, increasing clockwise. */
  readonly index: number;
  /** Display name, as printed on the tile. */
  readonly name: string;
}

export interface DeedSquare extends SquareBase {
  readonly kind: "campo" | "ruta" | "compania";
  readonly deedId: DeedId;
}

export interface MoneySquare extends SquareBase {
  readonly kind: "impuesto" | "premio";
  /** Positive = the bank pays you, negative = you pay the bank. */
  readonly amount: number;
}

export interface PlainSquare extends SquareBase {
  readonly kind: "tranquera" | "suerte" | "yeta" | "destacamento" | "siesta" | "mateada" | "enCana";
}

export type Square = DeedSquare | MoneySquare | PlainSquare;

/** Suerte is mostly good news, Yeta mostly bad. */
export type Deck = "suerte" | "yeta";

export type CardEffect =
  | { readonly type: "collect"; readonly amount: number }
  | { readonly type: "pay"; readonly amount: number }
  | { readonly type: "collectFromEachPlayer"; readonly amount: number }
  | {
      readonly type: "moveTo";
      readonly square: number;
      /** Whether passing the Tranquera on the way pays the usual bonus. */
      readonly collectTranquera: boolean;
      /** Which way the pawn travels; only affects animation, never the bonus. */
      readonly direction: "forward" | "backward";
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
  /** Text shown to the player, Spanish. */
  readonly text: string;
  readonly effect: CardEffect;
}
