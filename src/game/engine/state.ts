import type { Card, Deck, DeedId } from "../types";
import { STARTING_CASH, TOTAL_CHACRAS, TOTAL_ESTANCIAS } from "../constants";
import { shuffledDeck } from "../cards";

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly cash: number;
  /** Ring index 0-41. */
  readonly position: number;
  readonly inJail: boolean;
  /** Failed attempts to roll doubles while in jail. */
  readonly jailTurns: number;
  readonly getOutOfJailCards: number;
  /** Consecutive doubles rolled this turn. */
  readonly doublesThisTurn: number;
  readonly bankrupt: boolean;
}

export interface Holding {
  readonly ownerId: string;
  /** 0-4; ignored when `estancia` is true. */
  readonly chacras: number;
  readonly estancia: boolean;
  readonly mortgaged: boolean;
}

export type Creditor = { readonly type: "bank" } | { readonly type: "player"; readonly playerId: string };

/**
 * What the game is waiting for. Every phase names the player who must act via
 * `currentPlayerIndex`; there is never more than one pending decision.
 */
export type Phase =
  | { readonly type: "awaitingRoll" }
  | { readonly type: "awaitingJailDecision" }
  | { readonly type: "awaitingBuyDecision"; readonly deedId: DeedId }
  | { readonly type: "awaitingPayOrDraw"; readonly amount: number; readonly deck: Deck }
  | {
      readonly type: "awaitingPayment";
      readonly amount: number;
      readonly to: Creditor;
      readonly reason: string;
    }
  | { readonly type: "turnEnd" }
  | { readonly type: "gameOver"; readonly winnerId: string };

export interface LogEntry {
  readonly turn: number;
  readonly playerId: string;
  readonly text: string;
}

export interface GameState {
  readonly players: readonly Player[];
  readonly currentPlayerIndex: number;
  readonly holdings: Readonly<Partial<Record<DeedId, Holding>>>;
  /** Card ids, top of the deck first. Cards held by players are absent. */
  readonly decks: { readonly suerte: readonly string[]; readonly destino: readonly string[] };
  readonly bank: { readonly chacras: number; readonly estancias: number };
  readonly phase: Phase;
  readonly dice: readonly [number, number] | null;
  /** Card drawn on the current move, so the UI can show it. */
  readonly lastCard: Card | null;
  /** Set when the current roll was doubles and the player gets another go. */
  readonly rollAgain: boolean;
  readonly turn: number;
  readonly log: readonly LogEntry[];
}

export interface NewPlayer {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface CreateGameOptions {
  readonly players: readonly NewPlayer[];
  readonly startingCash?: number;
  readonly random?: () => number;
}

/**
 * Sets up a fresh game: every player on Salida with the starting cash, both
 * decks shuffled, and the first player in the list to roll.
 */
export function createGame({ players, startingCash = STARTING_CASH, random = Math.random }: CreateGameOptions): GameState {
  if (players.length < 2 || players.length > 6) {
    throw new Error("Chacarero se juega de 2 a 6 jugadores");
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error("Player ids must be unique");
  }
  return {
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      cash: startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      doublesThisTurn: 0,
      bankrupt: false,
    })),
    currentPlayerIndex: 0,
    holdings: {},
    decks: {
      suerte: shuffledDeck("suerte", random).map((c) => c.id),
      destino: shuffledDeck("destino", random).map((c) => c.id),
    },
    bank: { chacras: TOTAL_CHACRAS, estancias: TOTAL_ESTANCIAS },
    phase: { type: "awaitingRoll" },
    dice: null,
    lastCard: null,
    rollAgain: false,
    turn: 1,
    log: [],
  };
}

/** The player whose turn it is. */
export function currentPlayer(state: GameState): Player {
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new Error("Invalid currentPlayerIndex");
  return player;
}

export function getPlayer(state: GameState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`Unknown player ${id}`);
  return player;
}
