import type { Card, Deck, DeedId } from "../types";
import { DEAL_DEEDS_MAX, DECISION_SECONDS, STARTING_CASH } from "../constants";
import { shuffledDeck } from "../cards";
import { DEEDS } from "../deeds";
import type { TokenId } from "../tokens";
import { getToken } from "../tokens";

export interface Player {
  readonly id: string;
  readonly name: string;
  /** The piece they move; also fixes their colour and icon. */
  readonly token: TokenId;
  /** The token's colour, copied here so the UI never has to look it up. */
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
  /** Cash received from the bank this turn; returned if the turn ends with a third doubles. */
  readonly bankIncomeThisTurn: number;
  /** Out of the game: went broke, or (with `expelled`) voted out by the table. */
  readonly bankrupt: boolean;
  /** Taken out of the game by the table's vote after leaving; also `bankrupt`, so nothing waits for them. */
  readonly expelled: boolean;
}

export interface Holding {
  readonly ownerId: string;
  /** 0-4; ignored when `estancia` is true. */
  readonly chacras: number;
  readonly estancia: boolean;
  readonly mortgaged: boolean;
}

export type Creditor = { readonly type: "bank" } | { readonly type: "player"; readonly playerId: string };

/** Money someone owes and could not pay on the spot. */
export interface Debt {
  readonly debtorId: string;
  readonly amount: number;
  readonly to: Creditor;
  readonly reason: string;
}

/** A deed being auctioned by the bank. Bidders take turns; the highest bid wins when nobody else stays in. */
export interface Auction {
  readonly deedId: DeedId;
  readonly highestBid: number;
  readonly highestBidderId: string | null;
  /** Players still in the auction, in bidding order. */
  readonly bidders: readonly string[];
  /** Whose turn it is to bid or pass. */
  readonly turnBidderId: string;
}

/** One side of a trade: the deeds and cash a player hands over. */
export interface TradeOffer {
  readonly deeds: readonly DeedId[];
  readonly cash: number;
}

/** A proposal on the table: `fromId` hands `gives` to `toId` in exchange for `receives`. */
export interface Trade {
  readonly fromId: string;
  readonly toId: string;
  readonly gives: TradeOffer;
  readonly receives: TradeOffer;
}

/**
 * What the game is waiting for. Every phase names the player who must act via
 * `currentPlayerIndex`; there is never more than one pending decision.
 */
export type Phase =
  /** Before the first turn: everyone throws once, highest starts; ties throw again. */
  | { readonly type: "openingRoll"; readonly contenders: readonly string[]; readonly rolls: Readonly<Record<string, number>> }
  | { readonly type: "awaitingRoll" }
  | { readonly type: "awaitingJailDecision" }
  /** Dice are on the table; the player still has to move the pawn. */
  | { readonly type: "awaitingMove" }
  /** The pawn stands on Suerte/Destino; the player still has to lift the top card. */
  | { readonly type: "awaitingDraw"; readonly deck: Deck }
  /** A Suerte/Destino card is face up; its effect applies once acknowledged. */
  | { readonly type: "awaitingCardAck"; readonly card: Card }
  | { readonly type: "awaitingBuyDecision"; readonly deedId: DeedId }
  | { readonly type: "awaitingPayOrDraw"; readonly amount: number; readonly deck: Deck }
  | {
      readonly type: "awaitingPayment";
      /** Who must pay; not necessarily the player on turn (e.g. birthday cards). */
      readonly debtorId: string;
      readonly amount: number;
      readonly to: Creditor;
      readonly reason: string;
    }
  | { readonly type: "auction"; readonly auction: Auction }
  /** A trade is on the table; the game picks up at `resume` once it is answered. */
  | { readonly type: "awaitingTradeResponse"; readonly trade: Trade; readonly resume: Phase }
  | { readonly type: "turnEnd" }
  | { readonly type: "gameOver"; readonly winnerId: string };

export type MoveKind = "forward" | "backward" | "jump";

/** The most recent change of position, so the scene can animate it properly. */
export interface LastMove {
  readonly playerId: string;
  readonly from: number;
  readonly to: number;
  readonly kind: MoveKind;
}

export interface LogEntry {
  readonly turn: number;
  readonly playerId: string;
  readonly text: string;
}

/** Someone who can hold money: a player or the bank. */
export type Party = { readonly type: "bank" } | { readonly type: "player"; readonly playerId: string };

/**
 * What an action did, step by step, so the UI can replay it: a banner per
 * event plus the matching animation (bills flying, a card sliding, a chacra
 * dropping on a tile). `text` is the same line that goes into the log.
 */
export type GameEvent =
  | { readonly type: "log"; readonly playerId: string; readonly text: string }
  | { readonly type: "move"; readonly playerId: string; readonly from: number; readonly to: number; readonly kind: MoveKind; readonly text: string }
  | { readonly type: "transfer"; readonly from: Party; readonly to: Party; readonly amount: number; readonly text: string }
  | { readonly type: "deed"; readonly deedId: DeedId; readonly from: Party; readonly to: Party; readonly text: string }
  | { readonly type: "building"; readonly deedId: DeedId; readonly chacras: number; readonly estancia: boolean; readonly text: string }
  | { readonly type: "mortgage"; readonly deedId: DeedId; readonly mortgaged: boolean; readonly text: string }
  | { readonly type: "card"; readonly playerId: string; readonly deck: Deck; readonly cardId: string; readonly text: string }
  | { readonly type: "jail"; readonly playerId: string; readonly text: string }
  | { readonly type: "bankrupt"; readonly playerId: string; readonly text: string }
  | { readonly type: "turn"; readonly playerId: string; readonly text: string };

/** How long the table waits for each decision before taking the default. */
export interface TableClock {
  /** Seconds for any decision. */
  readonly decisionSeconds: number;
  /** Seconds to throw the dice (openings, turns, jail); null means the decision clock. */
  readonly rollSeconds: number | null;
}

export interface GameState {
  readonly players: readonly Player[];
  readonly clock: TableClock;
  readonly currentPlayerIndex: number;
  readonly holdings: Readonly<Partial<Record<DeedId, Holding>>>;
  /** Card ids, top of the deck first. Cards held by players are absent. */
  readonly decks: { readonly suerte: readonly string[]; readonly destino: readonly string[] };
  /** Debts waiting to be settled, oldest first; the head is what `awaitingPayment` shows. */
  readonly pendingDebts: readonly Debt[];
  /** Deeds the bank still has to auction this turn (after a bankruptcy to the bank). */
  readonly pendingAuctions: readonly DeedId[];
  readonly phase: Phase;
  readonly dice: readonly [number, number] | null;
  /** Card drawn on the current move, so the UI can show it. */
  readonly lastCard: Card | null;
  /** Set when the current roll was doubles and the player gets another go. */
  readonly rollAgain: boolean;
  readonly lastMove: LastMove | null;
  /** Every change of position caused by the latest action, in order (a card can move you twice). */
  readonly moves: readonly LastMove[];
  /** Everything the latest action did, in order, for the UI to replay. */
  readonly events: readonly GameEvent[];
  readonly turn: number;
  readonly log: readonly LogEntry[];
}

export interface NewPlayer {
  readonly id: string;
  readonly name: string;
  readonly token: TokenId;
}

/** What the table agrees on before the first roll. */
export interface GameSetup {
  readonly startingCash: number;
  /**
   * Deeds handed out to each player, free, before the first roll. The rulebook
   * suggests it to shorten the game; it also makes trades and building
   * available from turn one.
   */
  readonly dealDeeds: number;
  /** Seconds per decision before the table takes the default. */
  readonly decisionSeconds: number;
  /** Seconds to throw the dice; null uses `decisionSeconds`. */
  readonly rollSeconds: number | null;
}

export const DEFAULT_SETUP: GameSetup = { startingCash: STARTING_CASH, dealDeeds: 0, decisionSeconds: DECISION_SECONDS, rollSeconds: null };

export interface CreateGameOptions {
  readonly players: readonly NewPlayer[];
  readonly startingCash?: number;
  readonly dealDeeds?: number;
  readonly decisionSeconds?: number;
  readonly rollSeconds?: number | null;
  /** Whether the table throws for who starts (default); off, the first player in the list rolls first. */
  readonly openingRoll?: boolean;
  readonly random?: () => number;
}

/** Deals `perPlayer` random deeds to each player, round-robin from a shuffled pile. */
function dealHoldings(players: readonly NewPlayer[], perPlayer: number, random: () => number): GameState["holdings"] {
  const pile = DEEDS.map((d) => d.id);
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = pile[i];
    const b = pile[j];
    if (a !== undefined && b !== undefined) {
      pile[i] = b;
      pile[j] = a;
    }
  }
  const holdings: Partial<Record<DeedId, Holding>> = {};
  const rounds = Math.min(perPlayer, Math.floor(pile.length / players.length));
  let next = 0;
  for (let round = 0; round < rounds; round++) {
    for (const player of players) {
      const id = pile[next++];
      if (id !== undefined) holdings[id] = { ownerId: player.id, chacras: 0, estancia: false, mortgaged: false };
    }
  }
  return holdings;
}

/**
 * Sets up a fresh game: every player on Salida with the starting cash, both
 * decks shuffled, optionally a few deeds each, and the first player in the
 * list to roll.
 */
export function createGame({ players, startingCash = STARTING_CASH, dealDeeds = 0, decisionSeconds = DECISION_SECONDS, rollSeconds = null, openingRoll = true, random = Math.random }: CreateGameOptions): GameState {
  if (players.length < 2 || players.length > 6) {
    throw new Error("Chacarero se juega de 2 a 6 jugadores");
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error("Player ids must be unique");
  }
  if (new Set(players.map((p) => p.token)).size !== players.length) {
    throw new Error("Cada jugador necesita una ficha distinta");
  }
  if (!Number.isInteger(dealDeeds) || dealDeeds < 0 || dealDeeds > DEAL_DEEDS_MAX) {
    throw new Error(`Se reparten de 0 a ${DEAL_DEEDS_MAX} escrituras por jugador`);
  }
  if (!(decisionSeconds > 0) || (rollSeconds !== null && !(rollSeconds > 0))) {
    throw new Error("El reloj de la mesa necesita segundos positivos");
  }
  return {
    clock: { decisionSeconds, rollSeconds },
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      token: p.token,
      color: getToken(p.token).color,
      cash: startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      doublesThisTurn: 0,
      bankIncomeThisTurn: 0,
      bankrupt: false,
      expelled: false,
    })),
    currentPlayerIndex: 0,
    holdings: dealDeeds > 0 ? dealHoldings(players, dealDeeds, random) : {},
    pendingDebts: [],
    pendingAuctions: [],
    decks: {
      suerte: shuffledDeck("suerte", random).map((c) => c.id),
      destino: shuffledDeck("destino", random).map((c) => c.id),
    },
    phase: openingRoll ? { type: "openingRoll", contenders: players.map((p) => p.id), rolls: {} } : { type: "awaitingRoll" },
    dice: null,
    lastCard: null,
    rollAgain: false,
    lastMove: null,
    moves: [],
    events: [],
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

/**
 * The player who has to act right now: the debtor while a debt is being
 * settled, the bidder on turn during an auction, the player a trade was
 * proposed to, otherwise the player on turn.
 */
export function activePlayer(state: GameState): Player {
  switch (state.phase.type) {
    case "awaitingPayment":
      return getPlayer(state, state.phase.debtorId);
    case "auction":
      return getPlayer(state, state.phase.auction.turnBidderId);
    case "awaitingTradeResponse":
      return getPlayer(state, state.phase.trade.toId);
    default:
      return currentPlayer(state);
  }
}
