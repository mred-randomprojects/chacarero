import { describe, expect, it } from "vitest";
import type { DeedId } from "../types";
import { JAIL_BAIL, TRANQUERA_BONUS, STARTING_CASH } from "../constants";
import { TOKEN_IDS } from "../tokens";
import type { GameState, Holding, NewPlayer, Player } from "./state";
import { activePlayer, createGame, currentPlayer, getPlayer } from "./state";
import {
  MIN_BID_INCREMENT,
  acceptTrade,
  acknowledgeCard,
  bid,
  buildChacra,
  buildEstancia,
  buy,
  cancelTrade,
  chooseDraw,
  choosePay,
  counterTrade,
  declareBankruptcy,
  decline,
  drawCard,
  endTurn,
  expelPlayer,
  mortgage,
  movePawn,
  passBid,
  payBail,
  proposeTrade,
  rejectTrade,
  roll,
  rollDice,
  sellBuilding,
  settlePayment,
  unmortgage,
  spendJailCard,
} from "./actions";
import { camposOf } from "../deeds";
import { ALL_CARDS } from "../cards";
import { canBuildChacra, canBuildEstancia, canTradeDeed, checkTrade, mortgageProceeds, mortgageTransferFee, rentFor, tradeBalance, unmortgageCost } from "./rules";

const ANA: NewPlayer = { id: "ana", name: "Ana", token: "tractor" };
const BETO: NewPlayer = { id: "beto", name: "Beto", token: "vaca" };
const CARLA: NewPlayer = { id: "carla", name: "Carla", token: "caballo" };

function game(players = [ANA, BETO]): GameState {
  return createGame({ players, openingRoll: false, random: () => 0.5 });
}

function withPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function withHolding(state: GameState, deedId: DeedId, holding: Partial<Holding> & { ownerId: string }): GameState {
  return { ...state, holdings: { ...state.holdings, [deedId]: { chacras: 0, estancia: false, mortgaged: false, ...holding } } };
}

function withDecks(state: GameState, suerte: readonly string[], yeta: readonly string[]): GameState {
  return { ...state, decks: { suerte, yeta } };
}

/** Gives a player every zone of a province. */
function withProvince(state: GameState, ownerId: string, ids: readonly DeedId[], chacras = 0): GameState {
  return ids.reduce((s, id) => withHolding(s, id, { ownerId, chacras }), state);
}

const JUJUY: readonly DeedId[] = ["tilcara", "humahuaca", "purmamarca"];

describe("createGame", () => {
  it("starts everyone on the Tranquera with the starting cash", () => {
    const state = game();
    expect(state.players).toHaveLength(2);
    for (const p of state.players) {
      expect(p.cash).toBe(STARTING_CASH);
      expect(p.position).toBe(0);
    }
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(state.decks.suerte).toHaveLength(16);
    expect(state.decks.yeta).toHaveLength(16);
  });

  it("can deal a few deeds to each player before the first roll", () => {
    const state = createGame({ players: [ANA, BETO, CARLA], dealDeeds: 3, openingRoll: false, random: () => 0.5 });
    const holdings = Object.values(state.holdings);
    expect(holdings).toHaveLength(9);
    for (const p of [ANA, BETO, CARLA]) expect(holdings.filter((h) => h.ownerId === p.id)).toHaveLength(3);
    expect(holdings.every((h) => !h.mortgaged && h.chacras === 0 && !h.estancia)).toBe(true);
    // Dealt deeds are free.
    expect(state.players.every((p) => p.cash === STARTING_CASH)).toBe(true);
    expect(Object.keys(game().holdings)).toHaveLength(0);
    expect(() => createGame({ players: [ANA, BETO], dealDeeds: 5 })).toThrow(/0 a 4/);
    expect(() => createGame({ players: [ANA, BETO], dealDeeds: -1 })).toThrow();
  });

  it("deals different hands on different shuffles", () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const a = createGame({ players: [ANA, BETO], dealDeeds: 4, random });
    const b = createGame({ players: [ANA, BETO], dealDeeds: 4, random });
    expect(Object.keys(a.holdings).sort()).not.toEqual(Object.keys(b.holdings).sort());
  });

  it("opens with a throw for who starts: highest wins, ties throw again among themselves", () => {
    let state = createGame({ players: [ANA, BETO, CARLA], random: () => 0.5 });
    expect(state.phase).toEqual({ type: "openingRoll", contenders: ["ana", "beto", "carla"], rolls: {} });
    expect(currentPlayer(state).id).toBe("ana");
    expect(() => movePawn(state)).toThrow();
    state = rollDice(state, undefined, [3, 3]);
    expect(currentPlayer(state).id).toBe("beto");
    state = rollDice(state, undefined, [4, 2]);
    expect(currentPlayer(state).id).toBe("carla");
    state = rollDice(state, undefined, [1, 2]);
    // Ana and Beto tied on 6: only they throw again.
    expect(state.phase).toEqual({ type: "openingRoll", contenders: ["ana", "beto"], rolls: {} });
    expect(currentPlayer(state).id).toBe("ana");
    state = rollDice(state, undefined, [1, 1]);
    state = rollDice(state, undefined, [5, 1]);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).id).toBe("beto");
    expect(state.events.at(-1)).toMatchObject({ type: "turn", playerId: "beto" });
    expect(state.turn).toBe(1);
    // Nobody moved or was charged during the opening.
    expect(state.players.every((p) => p.position === 0 && p.cash === STARTING_CASH)).toBe(true);
  });

  it("rejects fewer than 2 or more than 6 players", () => {
    expect(() => createGame({ players: [ANA] })).toThrow();
    expect(() => createGame({ players: Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: "x", token: TOKEN_IDS[i % TOKEN_IDS.length] ?? "tractor" })) })).toThrow();
    expect(() => createGame({ players: [ANA, ANA] })).toThrow();
  });
});

describe("rolling and buying", () => {
  it("moves the player and offers a free deed", () => {
    const state = roll(game(), undefined, [1, 2]);
    expect(currentPlayer(state).position).toBe(3);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "purmamarca" });
  });

  it("buying transfers the deed and ends the turn", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = buy(state);
    expect(state.holdings["purmamarca"]).toEqual({ ownerId: "ana", chacras: 0, estancia: false, mortgaged: false });
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 1_200);
    expect(state.phase).toEqual({ type: "turnEnd" });
    state = endTurn(state);
    expect(currentPlayer(state).id).toBe("beto");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(state.turn).toBe(2);
  });

  it("declining sends the deed to auction, starting with the next player", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = decline(state);
    expect(state.holdings["purmamarca"]).toBeUndefined();
    expect(state.phase).toMatchObject({ type: "auction", auction: { deedId: "purmamarca", highestBid: 0, turnBidderId: "beto", bidders: ["beto", "ana"] } });
    expect(activePlayer(state).id).toBe("beto");
  });

  it("refuses actions outside their phase", () => {
    const state = game();
    expect(() => buy(state)).toThrow();
    expect(() => endTurn(state)).toThrow();
    expect(() => payBail(state)).toThrow();
  });
});

describe("doubles", () => {
  it("grants another roll after resolving the square", () => {
    let state = roll(game(), undefined, [2, 2]); // lands on the tax square
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 5_000);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).doublesThisTurn).toBe(1);
    state = roll(state, undefined, [1, 3]); // 8: Tambo, free
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "tambo" });
    state = buy(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("sends the player to jail on the third consecutive doubles", () => {
    // First doubles lands on the tax square (4), second on the Tambo (8), third jails.
    let state = roll(game(), undefined, [2, 2]);
    expect(currentPlayer(state).position).toBe(4);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    state = roll(state, undefined, [2, 2]);
    expect(currentPlayer(state).position).toBe(8);
    state = buy(state);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    state = roll(state, undefined, [3, 3]);
    const ana = currentPlayer(state);
    expect(ana.inJail).toBe(true);
    expect(ana.position).toBe(14);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });
});

describe("special squares", () => {
  it("pays the Tranquera bonus when passing it", () => {
    let state = withPlayer(game(), "ana", { position: 40 });
    state = roll(state, undefined, [1, 2]);
    expect(currentPlayer(state).position).toBe(1);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + TRANQUERA_BONUS);
  });

  it("charges taxes and pays prizes", () => {
    let state = roll(game(), undefined, [1, 3]);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 5_000);
    expect(state.phase).toEqual({ type: "turnEnd" });
    state = roll(withPlayer(game(), "ana", { position: 0 }), undefined, [3, 4]);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 2_500);
  });

  it("¡En cana! puts the player in the Destacamento without the Tranquera bonus", () => {
    let state = withPlayer(game(), "ana", { position: 32 });
    state = roll(state, undefined, [1, 2]);
    const ana = currentPlayer(state);
    expect(ana.inJail).toBe(true);
    expect(ana.position).toBe(14);
    expect(ana.cash).toBe(STARTING_CASH);
    state = endTurn(state);
    state = endTurn({ ...roll(state, undefined, [1, 2]), phase: { type: "turnEnd" } });
    expect(currentPlayer(state).id).toBe("ana");
    expect(state.phase).toEqual({ type: "awaitingJailDecision" });
  });
});

describe("jail", () => {
  function jailed(): GameState {
    return { ...withPlayer(game(), "ana", { position: 14, inJail: true }), phase: { type: "awaitingJailDecision" } };
  }

  it("lets the player pay bail and roll", () => {
    let state = payBail(jailed());
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - JAIL_BAIL);
    expect(currentPlayer(state).inJail).toBe(false);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    state = roll(state, undefined, [1, 2]);
    expect(currentPlayer(state).position).toBe(17);
  });

  it("frees the player on doubles without an extra roll", () => {
    let state = roll(jailed(), undefined, [2, 2]);
    expect(currentPlayer(state).inJail).toBe(false);
    expect(currentPlayer(state).position).toBe(18);
    state = buy(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("keeps the player in for up to three failed rolls, then releases them", () => {
    let state = roll(jailed(), undefined, [1, 2]);
    expect(currentPlayer(state).inJail).toBe(true);
    expect(currentPlayer(state).jailTurns).toBe(1);
    expect(state.phase).toEqual({ type: "turnEnd" });
    state = { ...state, phase: { type: "awaitingJailDecision" } };
    state = roll(state, undefined, [1, 2]);
    state = { ...state, phase: { type: "awaitingJailDecision" } };
    state = roll(state, undefined, [1, 2]);
    expect(currentPlayer(state).inJail).toBe(false);
    expect(currentPlayer(state).position).toBe(17);
  });

  it("uses a get-out-of-jail card and returns it to the deck", () => {
    let state = withPlayer(jailed(), "ana", { getOutOfJailCards: 1 });
    state = withDecks(state, state.decks.suerte.filter((id) => id !== "suerte-01"), state.decks.yeta);
    state = spendJailCard(state);
    expect(currentPlayer(state).inJail).toBe(false);
    expect(currentPlayer(state).getOutOfJailCards).toBe(0);
    expect(state.decks.suerte.at(-1)).toBe("suerte-01");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });
});

describe("rent", () => {
  it("asks before the money moves: the table stops at the payment, and paying collects the bare rent", () => {
    let state = withHolding(game(), "humahuaca", { ownerId: "beto" });
    state = roll(state, undefined, [1, 1]);
    // Nothing has moved yet: the visitor is told the amount and pays it themselves.
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "ana", amount: 40, to: { type: "player", playerId: "beto" }, reason: /alquiler/ });
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH);
    state = settlePayment(state);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 40);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 40);
    expect(state.events.map((e) => e.type)).toEqual(["transfer"]);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });

  it("scales railway rent with the number owned and company rent with the dice", () => {
    let state = withHolding(game(), "ruta9", { ownerId: "beto" });
    expect(rentFor(state, "ruta9", "ana", 7)).toBe(500);
    state = withHolding(state, "ruta7", { ownerId: "beto" });
    expect(rentFor(state, "ruta9", "ana", 7)).toBe(1_000);
    state = withHolding(state, "tambo", { ownerId: "beto" });
    expect(rentFor(state, "tambo", "ana", 7)).toBe(700);
    state = withHolding(state, "frigorifico", { ownerId: "beto" });
    expect(rentFor(state, "tambo", "ana", 7)).toBe(1_400);
  });

  it("charges nothing when the owner is in jail, the deed is mortgaged, or it is yours", () => {
    let state = withHolding(game(), "humahuaca", { ownerId: "beto" });
    expect(rentFor(withPlayer(state, "beto", { inJail: true }), "humahuaca", "ana", 2)).toBe(0);
    expect(rentFor(withHolding(state, "humahuaca", { ownerId: "beto", mortgaged: true }), "humahuaca", "ana", 2)).toBe(0);
    expect(rentFor(state, "humahuaca", "beto", 2)).toBe(0);
    state = withPlayer(state, "beto", { inJail: true });
    state = roll(state, undefined, [1, 1]);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH);
  });

  it("uses the building ladder", () => {
    const state = withHolding(game(), "humahuaca", { ownerId: "beto", chacras: 3 });
    expect(rentFor(state, "humahuaca", "ana", 2)).toBe(1_700);
    expect(rentFor(withHolding(state, "humahuaca", { ownerId: "beto", estancia: true }), "humahuaca", "ana", 2)).toBe(4_750);
  });
});

describe("cards", () => {
  /** From Cosecha récord (7) to Suerte (10). */
  function onSuerte(state: GameState): GameState {
    return roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]);
  }

  /** From Ruta 9 (12) to Yeta (15). */
  function onYeta(state: GameState): GameState {
    return roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]);
  }

  it("collects money and rotates the card to the bottom", () => {
    let state = withDecks(game(), ["suerte-02", "suerte-14"], []);
    state = onSuerte(state);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 3_000);
    expect(state.decks.suerte).toEqual(["suerte-14", "suerte-02"]);
    expect(state.lastCard?.id).toBe("suerte-02");
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("keeps a get-out-of-jail card", () => {
    let state = withDecks(game(), ["suerte-01", "suerte-14"], []);
    state = onSuerte(state);
    expect(currentPlayer(state).getOutOfJailCards).toBe(1);
    expect(state.decks.suerte).toEqual(["suerte-14"]);
  });

  it("moves forward, collecting the Tranquera bonus when the card says so", () => {
    let state = withDecks(game(), ["suerte-15"], []);
    state = withPlayer(state, "ana", { position: 35 });
    state = roll(state, undefined, [1, 2]); // -> 38 Suerte
    expect(currentPlayer(state).position).toBe(13);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + TRANQUERA_BONUS);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "saltaCapital" });
  });

  it("moves back three squares without the Tranquera bonus", () => {
    let state = withDecks(game(), [], ["yeta-02"]);
    state = withHolding(state, "ruta9", { ownerId: "beto" });
    state = onYeta(state); // 15 -> 12 Ruta 9
    expect(currentPlayer(state).position).toBe(12);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", amount: 500 });
    expect(settlePayment(state).players[0]?.cash).toBe(STARTING_CASH - 500);
  });

  it("sends the player to jail", () => {
    let state = withDecks(game(), [], ["yeta-07"]);
    state = onYeta(state);
    expect(currentPlayer(state).inJail).toBe(true);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("charges per building", () => {
    let state = withDecks(game(), [], ["yeta-08"]);
    state = withProvince(state, "ana", JUJUY, 2);
    state = withHolding(state, "purmamarca", { ownerId: "ana", estancia: true });
    state = onYeta(state);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - (4 * 500 + 2_500));
  });

  it("collects from every other player on birthdays, making the broke ones liquidate", () => {
    let state = withDecks(game([ANA, BETO, CARLA]), ["suerte-06"], []);
    state = withPlayer(state, "carla", { cash: 50 });
    state = withHolding(state, "cachi", { ownerId: "carla" });
    state = onSuerte(state);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH - 200);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "carla", amount: 200, to: { type: "player", playerId: "ana" } });
    expect(activePlayer(state).id).toBe("carla");
    expect(() => settlePayment(state)).toThrow();
    state = mortgage(state, "cachi"); // Carla, the debtor, acts even though it is Ana's turn
    expect(getPlayer(state, "carla").cash).toBe(50 + 1_170);
    state = settlePayment(state);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH + 400);
    expect(getPlayer(state, "carla").cash).toBe(1_020);
    expect(state.phase).toEqual({ type: "turnEnd" });
    expect(currentPlayer(state).id).toBe("ana");
  });

  it("offers pay-or-draw and resolves either choice", () => {
    let state = withDecks(game(), ["suerte-04"], ["yeta-10"]);
    state = onYeta(state);
    expect(state.phase).toEqual({ type: "awaitingPayOrDraw", amount: 200, deck: "suerte" });
    const paid = choosePay(state);
    expect(currentPlayer(paid).cash).toBe(STARTING_CASH - 200);
    expect(paid.phase).toEqual({ type: "turnEnd" });
    let drew = chooseDraw(state);
    expect(drew.phase).toMatchObject({ type: "awaitingCardAck", card: { id: "suerte-04" } });
    drew = acknowledgeCard(drew);
    expect(currentPlayer(drew).cash).toBe(STARTING_CASH + 10_000);
  });
});

describe("building", () => {
  it("requires the whole province and builds evenly", () => {
    let state = withHolding(game(), "tilcara", { ownerId: "ana" });
    expect(canBuildChacra(state, currentPlayer(state), "tilcara").ok).toBe(false);
    state = withProvince(state, "ana", JUJUY);
    state = buildChacra(state, "tilcara");
    expect(state.holdings["tilcara"]?.chacras).toBe(1);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 1_000);
    expect(() => buildChacra(state, "tilcara")).toThrow(/parejo/);
    state = buildChacra(buildChacra(state, "humahuaca"), "purmamarca");
    state = buildChacra(state, "tilcara");
    expect(state.holdings["tilcara"]?.chacras).toBe(2);
  });

  it("upgrades four chacras to an estancia and sells buildings at half price", () => {
    let state = withProvince(game(), "ana", JUJUY, 4);
    state = buildEstancia(state, "tilcara");
    expect(state.holdings["tilcara"]).toMatchObject({ chacras: 0, estancia: true });
    expect(() => sellBuilding(state, "humahuaca")).toThrow(/parejo/);
    state = sellBuilding(state, "tilcara");
    expect(state.holdings["tilcara"]).toMatchObject({ chacras: 4, estancia: false });
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 1_000 + 500);
    state = sellBuilding(state, "tilcara");
    expect(state.holdings["tilcara"]?.chacras).toBe(3);
  });

  it("does not allow building on a province with a mortgaged zone", () => {
    let state = withProvince(game(), "ana", JUJUY);
    state = withHolding(state, "purmamarca", { ownerId: "ana", mortgaged: true });
    expect(canBuildChacra(state, currentPlayer(state), "tilcara")).toMatchObject({ ok: false });
  });
});

describe("mortgages", () => {
  it("pays out 90 % of the mortgage value and costs 110 % to lift", () => {
    expect(mortgageProceeds("tilcara")).toBe(450);
    expect(unmortgageCost("tilcara")).toBe(550);
    let state = withHolding(game(), "tilcara", { ownerId: "ana" });
    state = mortgage(state, "tilcara");
    expect(state.holdings["tilcara"]?.mortgaged).toBe(true);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 450);
    expect(() => mortgage(state, "tilcara")).toThrow();
    state = unmortgage(state, "tilcara");
    expect(state.holdings["tilcara"]?.mortgaged).toBe(false);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 450 - 550);
  });

  it("refuses to mortgage a built campo", () => {
    const state = withHolding(game(), "tilcara", { ownerId: "ana", chacras: 1 });
    expect(() => mortgage(state, "tilcara")).toThrow();
  });
});

describe("debts and bankruptcy", () => {
  it("waits for the player to raise cash, then settles", () => {
    let state = withHolding(game(), "humahuaca", { ownerId: "beto", estancia: true });
    state = withHolding(state, "cachi", { ownerId: "ana" });
    state = withPlayer(state, "ana", { cash: 4_000 });
    state = roll(state, undefined, [1, 1]);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", amount: 4_750 });
    expect(() => settlePayment(state)).toThrow();
    expect(() => declareBankruptcy(state)).toThrow(/vender o hipotecar/);
    state = mortgage(state, "cachi");
    state = settlePayment(state);
    expect(getPlayer(state, "ana").cash).toBe(4_000 + 1_170 - 4_750);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 4_750);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });

  it("hands everything to the creditor and ends the game with two players", () => {
    let state = withHolding(game(), "humahuaca", { ownerId: "beto", estancia: true });
    state = withHolding(state, "cachi", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { cash: 100, getOutOfJailCards: 1 });
    state = roll(state, undefined, [1, 1]);
    expect(state.phase.type).toBe("awaitingPayment");
    state = declareBankruptcy(state);
    expect(getPlayer(state, "ana").bankrupt).toBe(true);
    expect(getPlayer(state, "ana").cash).toBe(0);
    expect(state.holdings["cachi"]).toEqual({ ownerId: "beto", chacras: 0, estancia: false, mortgaged: true });
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 100);
    expect(getPlayer(state, "beto").getOutOfJailCards).toBe(1);
    state = endTurn(state);
    expect(state.phase).toEqual({ type: "gameOver", winnerId: "beto" });
  });

  it("returns deeds to the bank when the creditor is the bank, which auctions them", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "tilcara", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { cash: 100 });
    state = roll(state, undefined, [1, 3]); // tax 5000
    expect(state.phase).toMatchObject({ type: "awaitingPayment", to: { type: "bank" } });
    state = declareBankruptcy(state);
    expect(state.holdings["tilcara"]).toBeUndefined();
    expect(state.phase).toMatchObject({ type: "auction", auction: { deedId: "tilcara", bidders: ["beto", "carla"], turnBidderId: "beto" } });
    state = bid(state, 300);
    state = passBid(state);
    expect(state.holdings["tilcara"]).toMatchObject({ ownerId: "beto", mortgaged: false });
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH - 300);
    expect(state.phase).toEqual({ type: "turnEnd" });
    state = endTurn(state);
    expect(currentPlayer(state).id).toBe("beto");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });

  it("skips bankrupt players when passing the turn", () => {
    let state = game([ANA, BETO, CARLA]);
    state = withPlayer(state, "beto", { bankrupt: true });
    state = { ...state, phase: { type: "turnEnd" } };
    state = endTurn(state);
    expect(currentPlayer(state).id).toBe("carla");
  });
});

describe("lastMove", () => {
  it("records forward rolls, backward cards and the jump to jail", () => {
    let state = roll(game(), undefined, [1, 2]);
    expect(state.lastMove).toEqual({ playerId: "ana", from: 0, to: 3, kind: "forward" });
    state = withDecks(decline(state), [], ["yeta-09", "yeta-07"]);
    state = { ...state, phase: { type: "awaitingRoll" } };
    state = roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]); // 15 Yeta -> back to Tilcara
    expect(state.lastMove).toEqual({ playerId: "ana", from: 15, to: 1, kind: "backward" });
    state = { ...state, phase: { type: "awaitingRoll" } };
    state = roll(withPlayer(state, "ana", { position: 33 }), undefined, [1, 2]); // 36 Yeta -> jail
    expect(state.lastMove).toEqual({ playerId: "ana", from: 36, to: 14, kind: "jump" });
  });
});

describe("edge cases", () => {
  it("pays the Tranquera bonus exactly once when landing on it", () => {
    let state = withPlayer(game(), "ana", { position: 38 });
    state = roll(state, undefined, [1, 3]);
    expect(currentPlayer(state).position).toBe(0);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + TRANQUERA_BONUS);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("does not pay the Tranquera bonus when moving backwards across it", () => {
    let state = withDecks(game(), [], ["yeta-02"]);
    state = withPlayer(state, "ana", { position: 33 });
    state = roll(state, undefined, [1, 2]); // 36 Yeta -> back 3 = 33
    expect(currentPlayer(state).position).toBe(33);
    state = withDecks(game(), [], ["yeta-02"]);
    state = withPlayer(state, "ana", { position: 12 });
    state = roll(state, undefined, [1, 2]); // 15 -> 12 Ruta 9
    expect(currentPlayer(state).cash).toBe(STARTING_CASH);
  });

  it("'Volvé a la Tranquera' from the last squares pays the bonus", () => {
    let state = withDecks(game(), ["suerte-05"], []);
    state = withPlayer(state, "ana", { position: 35 });
    state = roll(state, undefined, [1, 2]); // 38 Suerte
    expect(currentPlayer(state).position).toBe(0);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + TRANQUERA_BONUS);
  });

  it("'¡En cana!' by card cancels the extra roll for doubles", () => {
    let state = withDecks(game(), [], ["yeta-07"]);
    state = withPlayer(state, "ana", { position: 11 });
    state = roll(state, undefined, [2, 2]); // 15 Yeta -> jail
    expect(currentPlayer(state).inJail).toBe(true);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("landing on ¡En cana! with doubles does not roll again", () => {
    let state = withPlayer(game(), "ana", { position: 31 });
    state = roll(state, undefined, [2, 2]);
    expect(currentPlayer(state).inJail).toBe(true);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("refuses to buy what you cannot afford", () => {
    let state = withPlayer(game(), "ana", { cash: 1_000 });
    state = roll(state, undefined, [1, 2]); // Purmamarca 1.200
    expect(() => buy(state)).toThrow();
    state = decline(state);
    expect(state.phase.type).toBe("auction");
  });

  it("refuses bail without the cash", () => {
    const state: GameState = { ...withPlayer(game(), "ana", { position: 14, inJail: true, cash: 500 }), phase: { type: "awaitingJailDecision" } };
    expect(() => payBail(state)).toThrow();
  });

  it("never runs out of buildings: every province can be fully built at once", () => {
    // 22 campos × 4 chacras = 88 chacras, far beyond the 32 in the box; the bank keeps selling.
    const provinces = ["jujuy", "misiones", "salta", "chubut", "mendoza", "rioNegro", "cordoba", "buenosAires"] as const;
    let state = withPlayer(game(), "ana", { cash: 1_000_000 });
    for (const province of provinces) state = withProvince(state, "ana", camposOf(province).map((c) => c.id), 4);
    for (const province of provinces) {
      for (const campo of camposOf(province)) {
        expect(canBuildEstancia(state, currentPlayer(state), campo.id).ok).toBe(true);
        state = buildEstancia(state, campo.id);
      }
    }
    expect(Object.values(state.holdings).every((h) => h.estancia)).toBe(true);
    // And selling an estancia always hands back four chacras.
    state = sellBuilding(state, "tilcara");
    expect(state.holdings["tilcara"]).toMatchObject({ chacras: 4, estancia: false });
  });

  it("does not let you build while you owe money you cannot cover, but lets you sell", () => {
    let state = withProvince(game(), "ana", JUJUY, 1);
    state = withHolding(state, "marDelPlata", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { position: 37, cash: 100 });
    state = roll(state, undefined, [1, 2]); // 40 Bs As Norte: 36.000 rent
    expect(state.phase.type).toBe("awaitingPayment");
    expect(() => buildChacra(state, "tilcara")).toThrow(/plata/);
    state = sellBuilding(state, "tilcara");
    expect(getPlayer(state, "ana").cash).toBe(600);
  });

  it("keeps two get-out-of-jail cards and uses them one at a time", () => {
    let state = withDecks(game(), ["suerte-01"], ["yeta-14"]);
    state = roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]); // 15 Yeta
    expect(currentPlayer(state).getOutOfJailCards).toBe(1);
    state = { ...state, phase: { type: "awaitingRoll" } };
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]); // 10 Suerte
    expect(currentPlayer(state).getOutOfJailCards).toBe(2);
    expect(state.decks.suerte).toEqual([]);
    expect(state.decks.yeta).toEqual([]);
    state = { ...withPlayer(state, "ana", { inJail: true, position: 14 }), phase: { type: "awaitingJailDecision" } };
    state = spendJailCard(state);
    expect(currentPlayer(state).getOutOfJailCards).toBe(1);
    expect(state.decks.suerte).toHaveLength(1);
  });

  it("company rent uses the dice that brought you there", () => {
    let state = withHolding(game(), "tambo", { ownerId: "beto" });
    state = settlePayment(roll(state, undefined, [3, 5]));
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 800);
  });

  it("charges rent when a card moves you onto someone's property", () => {
    let state = withDecks(game(), [], ["yeta-01"]);
    state = withHolding(state, "frigorifico", { ownerId: "beto" });
    state = roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]); // Yeta -> Frigorífico
    expect(currentPlayer(state).position).toBe(16);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "ana", amount: 300 });
    expect(getPlayer(settlePayment(state), "beto").cash).toBe(STARTING_CASH + 300);
  });

  it("the bankrupt player's creditor inherits mortgaged deeds as mortgaged", () => {
    let state = withHolding(game(), "marDelPlata", { ownerId: "beto", estancia: true });
    state = withHolding(state, "tilcara", { ownerId: "ana", mortgaged: true });
    state = withHolding(state, "ruta7", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { position: 37, cash: 10 });
    state = roll(state, undefined, [1, 2]);
    state = declareBankruptcy(state);
    expect(state.holdings["tilcara"]?.mortgaged).toBe(true);
    expect(state.holdings["ruta7"]?.ownerId).toBe("beto");
  });

  it("returns buildings to the bank when a player goes bankrupt", () => {
    let state = withProvince(game(), "ana", JUJUY, 2);
    state = withHolding(state, "marDelPlata", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { position: 37, cash: 10 });
    state = roll(state, undefined, [1, 2]);
    // Ana can still sell chacras, so she must do that before bankruptcy.
    expect(() => declareBankruptcy(state)).toThrow();
    for (let i = 0; i < 6; i++) {
      const id = JUJUY[i % 3];
      if (id) state = sellBuilding(state, id);
    }
    expect(getPlayer(state, "ana").cash).toBe(10 + 6 * 500);
    state = JUJUY.reduce((s, id) => mortgage(s, id), state);
    expect(() => settlePayment(state)).toThrow();
    state = declareBankruptcy(state);
    // Jujuy went to Beto bare: the chacras were sold back, not handed over.
    expect(JUJUY.every((id) => state.holdings[id]?.ownerId === "beto" && state.holdings[id]?.chacras === 0)).toBe(true);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 10 + 3_000 + 450 + 450 + 540);
  });

  it("game continues with three players after one goes bankrupt", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "marDelPlata", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { position: 37, cash: 10 });
    state = roll(state, undefined, [1, 2]);
    state = declareBankruptcy(state);
    state = endTurn(state);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).id).toBe("beto");
    state = { ...state, phase: { type: "turnEnd" } };
    state = endTurn(state);
    expect(currentPlayer(state).id).toBe("carla");
    state = { ...state, phase: { type: "turnEnd" } };
    state = endTurn(state);
    expect(currentPlayer(state).id).toBe("beto");
  });

  it("a bankrupt player's pawn never gets a turn again even if it was mid-doubles", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "purmamarca", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { cash: 10, doublesThisTurn: 1 });
    state = { ...state, rollAgain: true };
    state = roll(state, undefined, [1, 2]); // Purmamarca: 9.500
    state = declareBankruptcy(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("birthday money comes from everyone still playing", () => {
    let state = withDecks(game([ANA, BETO, CARLA]), ["suerte-06"], []);
    state = withPlayer(state, "carla", { bankrupt: true, cash: 0 });
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]); // 10 Suerte
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH + 200);
    expect(getPlayer(state, "carla").cash).toBe(0);
  });

  it("rent is not charged on a bankrupt player's former deed left with the bank", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "humahuaca", { ownerId: "beto", mortgaged: true });
    state = withPlayer(state, "beto", { bankrupt: true });
    expect(rentFor(state, "humahuaca", "ana", 2)).toBe(0);
  });
});

describe("auctions", () => {
  function auctionFor(players = [ANA, BETO, CARLA]): GameState {
    return decline(roll(game(players), undefined, [1, 2])); // Purmamarca
  }

  it("goes around, skipping the highest bidder, until nobody else stays in", () => {
    let state = auctionFor();
    expect(activePlayer(state).id).toBe("beto");
    state = bid(state, 500);
    expect(activePlayer(state).id).toBe("carla");
    state = bid(state, 700);
    expect(activePlayer(state).id).toBe("ana");
    state = passBid(state);
    expect(activePlayer(state).id).toBe("beto");
    state = bid(state, 900);
    expect(activePlayer(state).id).toBe("carla");
    state = passBid(state);
    expect(state.holdings["purmamarca"]).toMatchObject({ ownerId: "beto" });
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH - 900);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("leaves the deed with the bank when everyone passes", () => {
    let state = auctionFor();
    state = passBid(passBid(passBid(state)));
    expect(state.holdings["purmamarca"]).toBeUndefined();
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("enforces the minimum increment and the bidder's cash", () => {
    let state = auctionFor();
    expect(() => bid(state, 50)).toThrow();
    state = bid(state, MIN_BID_INCREMENT);
    expect(() => bid(state, MIN_BID_INCREMENT)).toThrow();
    expect(() => bid(state, STARTING_CASH + 1)).toThrow();
    expect(() => bid(state, 150.5)).toThrow();
  });

  it("lets the decliner win their own auction cheaply", () => {
    let state = auctionFor([ANA, BETO]);
    state = passBid(state); // beto
    expect(activePlayer(state).id).toBe("ana");
    state = bid(state, 100);
    expect(state.holdings["purmamarca"]).toMatchObject({ ownerId: "ana" });
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 100);
  });

  it("does not allow building or mortgaging during an auction", () => {
    let state = withHolding(game(), "cachi", { ownerId: "ana" });
    state = decline(roll(state, undefined, [1, 2]));
    expect(() => mortgage(state, "cachi")).toThrow(/remate/);
  });

  it("keeps the doubles re-roll after an auction", () => {
    let state = roll(game([ANA, BETO]), undefined, [1, 1]); // Humahuaca, doubles
    state = decline(state);
    state = passBid(passBid(state));
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).id).toBe("ana");
  });
});

describe("three doubles clawback", () => {
  it("returns what the bank paid this turn when the third doubles sends you to jail", () => {
    let state = withPlayer(game(), "ana", { position: 41 });
    state = roll(state, undefined, [1, 1]); // passes the Tranquera: +5000, lands on Tilcara
    state = buy(state);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 5_000 - 1_000);
    state = roll(state, undefined, [3, 3]); // 7: Cosecha récord +2500
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 5_000 - 1_000 + 2_500);
    state = roll(state, undefined, [2, 2]); // third doubles
    expect(currentPlayer(state).inJail).toBe(true);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 1_000);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("queues a debt when the money was already spent", () => {
    let state = withPlayer(game(), "ana", { position: 41, cash: 100 });
    state = roll(state, undefined, [1, 1]); // +5000
    state = buy(state); // spends 1000 -> 4100
    state = roll(state, undefined, [3, 3]); // +2500 -> 6600
    state = withPlayer(state, "ana", { cash: 500 }); // pretend it was spent elsewhere
    state = roll(state, undefined, [2, 2]);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "ana", amount: 7_500, to: { type: "bank" } });
  });

  it("does not count money received from other players", () => {
    let state = withHolding(game(), "humahuaca", { ownerId: "ana" });
    state = withPlayer(state, "ana", { position: 0 });
    state = { ...withPlayer(state, "beto", { position: 0 }), currentPlayerIndex: 1 };
    state = roll(state, undefined, [1, 1]); // beto lands on ana's campo: 40 to ana
    expect(getPlayer(state, "ana").bankIncomeThisTurn).toBe(0);
  });

  it("resets the tally at the start of each turn", () => {
    let state = roll(withPlayer(game(), "ana", { position: 40 }), undefined, [1, 2]); // +5000
    expect(currentPlayer(state).bankIncomeThisTurn).toBe(5_000);
    state = endTurn({ ...state, phase: { type: "turnEnd" } });
    state = endTurn({ ...state, phase: { type: "turnEnd" } });
    expect(currentPlayer(state).id).toBe("ana");
    expect(currentPlayer(state).bankIncomeThisTurn).toBe(0);
  });
});

describe("visible company rent", () => {
  it("spells out the dice and multiplier in the payment and in the log", () => {
    let state = withHolding(game(), "tambo", { ownerId: "beto" });
    state = roll(state, undefined, [3, 5]);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", reason: expect.stringContaining("dados 3+5 = 8 × 100") });
    state = settlePayment(state);
    expect(state.log.at(-1)?.text).toContain("dados 3+5 = 8 × 100");
  });
});

describe("moves per action", () => {
  it("splits a turn into roll, move and card steps, each with its own moves and events", () => {
    let state = withDecks(game(), [], ["yeta-02"]);
    state = rollDice(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]);
    expect(state.phase).toEqual({ type: "awaitingMove" });
    expect(state.moves).toEqual([]);
    expect(state.events.map((e) => e.type)).toEqual(["log"]);
    state = movePawn(state); // 15 Yeta
    expect(state.moves).toEqual([{ playerId: "ana", from: 12, to: 15, kind: "forward" }]);
    expect(state.phase).toEqual({ type: "awaitingDraw", deck: "yeta" });
    expect(state.events.map((e) => e.type)).toEqual(["move", "log"]);
    expect(() => acknowledgeCard(state)).toThrow();
    state = drawCard(state);
    expect(state.moves).toEqual([]);
    expect(state.phase).toMatchObject({ type: "awaitingCardAck", card: { id: "yeta-02" } });
    expect(state.events.map((e) => e.type)).toEqual(["card"]);
    state = acknowledgeCard(state); // back 3 = 12, Ruta 9 free
    expect(state.moves).toEqual([{ playerId: "ana", from: 15, to: 12, kind: "backward" }]);
    expect(currentPlayer(state).position).toBe(12);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "ruta9" });
  });

  it("emits a transfer and a deed event on purchase", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = buy(state);
    expect(state.events.map((e) => e.type)).toEqual(["transfer", "deed"]);
    expect(state.events[0]).toMatchObject({ type: "transfer", from: { type: "player", playerId: "ana" }, to: { type: "bank" }, amount: 1_200 });
    expect(state.events[1]).toMatchObject({ type: "deed", deedId: "purmamarca", to: { type: "player", playerId: "ana" } });
  });

  it("emits the Tranquera bonus as a transfer from the bank", () => {
    const state = roll(withPlayer(game(), "ana", { position: 40 }), undefined, [1, 2]);
    expect(state.events).toContainEqual(expect.objectContaining({ type: "transfer", from: { type: "bank" }, amount: 5_000 }));
  });

  it("clears the list on the next action", () => {
    let state = roll(game(), undefined, [1, 2]);
    expect(state.moves).toHaveLength(1);
    state = buy(state);
    expect(state.moves).toHaveLength(0);
  });
});

describe("trades", () => {
  const NOTHING = { deeds: [], cash: 0 } as const;

  /** Ana owns Tilcara and Cachi; Beto owns Purmamarca (mortgaged) and Cafayate. Ana is on turn. */
  function table(): GameState {
    let state = game([ANA, BETO, CARLA]);
    state = withHolding(state, "tilcara", { ownerId: "ana" });
    state = withHolding(state, "cachi", { ownerId: "ana" });
    state = withHolding(state, "purmamarca", { ownerId: "beto", mortgaged: true });
    state = withHolding(state, "cafayate", { ownerId: "beto" });
    return { ...state, phase: { type: "turnEnd" } };
  }

  it("proposing pauses the game and remembers where to resume", () => {
    const state = proposeTrade(table(), "beto", { deeds: ["cachi"], cash: 500 }, { deeds: ["cafayate"], cash: 0 });
    expect(state.phase).toMatchObject({
      type: "awaitingTradeResponse",
      trade: { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 500 }, receives: { deeds: ["cafayate"], cash: 0 } },
      resume: { type: "turnEnd" },
    });
    expect(activePlayer(state).id).toBe("beto");
    expect(state.events).toEqual([{ type: "log", playerId: "ana", text: "Ana le propone un canje a Beto: da Cachi y $500 a cambio de Cafayate." }]);
    // Nothing else moves while the offer is on the table.
    expect(() => endTurn(state)).toThrow();
    expect(() => mortgage(state, "tilcara")).toThrow(/canje pendiente/);
    expect(() => proposeTrade(state, "carla", { deeds: ["tilcara"], cash: 0 }, NOTHING)).toThrow(/canje pendiente/);
  });

  it("accepting crosses cash and deeds, charges the mortgage fee, and resumes", () => {
    let state = proposeTrade(table(), "beto", { deeds: ["cachi"], cash: 500 }, { deeds: ["cafayate", "purmamarca"], cash: 0 });
    state = acceptTrade(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
    expect(state.holdings["cachi"]).toMatchObject({ ownerId: "beto", mortgaged: false });
    expect(state.holdings["cafayate"]).toMatchObject({ ownerId: "ana" });
    expect(state.holdings["purmamarca"]).toMatchObject({ ownerId: "ana", mortgaged: true });
    const fee = mortgageTransferFee("purmamarca");
    expect(fee).toBe(60);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 500 - fee);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 500);
    const kinds = state.events.map((e) => e.type);
    expect(kinds).toEqual(["log", "transfer", "deed", "deed", "deed", "transfer"]);
    expect(state.events.map((e) => e.text)).toContain("Ana paga $60 al Banco (10 % por recibir Purmamarca hipotecada).");
    // The mortgage carries over: lifting it costs the usual amount.
    expect(() => unmortgage(state, "purmamarca")).not.toThrow();
  });

  it("rejecting and cancelling change nothing but the log", () => {
    const proposed = proposeTrade(table(), "beto", { deeds: ["cachi"], cash: 0 }, { deeds: ["cafayate"], cash: 1_000 });
    const rejected = rejectTrade(proposed);
    expect(rejected.phase).toEqual({ type: "turnEnd" });
    expect(rejected.holdings).toEqual(table().holdings);
    expect(rejected.events).toEqual([{ type: "log", playerId: "beto", text: "Beto rechaza el canje." }]);
    const cancelled = cancelTrade(proposed);
    expect(cancelled.phase).toEqual({ type: "turnEnd" });
    expect(cancelled.events).toEqual([{ type: "log", playerId: "ana", text: "Ana retira el canje." }]);
  });

  it("a counter-offer swaps the roles and keeps the resume point", () => {
    let state = proposeTrade(table(), "beto", { deeds: ["cachi"], cash: 0 }, { deeds: ["cafayate"], cash: 0 });
    state = counterTrade(state, { deeds: ["cafayate"], cash: 0 }, { deeds: ["cachi"], cash: 2_000 });
    expect(state.phase).toMatchObject({
      type: "awaitingTradeResponse",
      trade: { fromId: "beto", toId: "ana", gives: { deeds: ["cafayate"], cash: 0 }, receives: { deeds: ["cachi"], cash: 2_000 } },
      resume: { type: "turnEnd" },
    });
    expect(activePlayer(state).id).toBe("ana");
    state = acceptTrade(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 2_000);
    expect(state.holdings["cachi"]?.ownerId).toBe("beto");
    expect(state.holdings["cafayate"]?.ownerId).toBe("ana");
  });

  it("only allows well-formed trades of bare deeds between two solvent players", () => {
    const state = table();
    expect(checkTrade(state, { fromId: "ana", toId: "ana", gives: { deeds: ["cachi"], cash: 0 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /vos mismo/ });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: NOTHING, receives: NOTHING })).toMatchObject({ ok: false, reason: /al menos una escritura/ });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: [], cash: 1_000 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /al menos una escritura/ });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cafayate"], cash: 0 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /no es de Ana/ });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 0 }, receives: { deeds: ["cachi"], cash: 0 } })).toMatchObject({ ok: false });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 1.5 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /entero/ });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: -100 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /entero/ });
    expect(checkTrade(state, { fromId: "ana", toId: "nadie", gives: { deeds: ["cachi"], cash: 0 }, receives: NOTHING })).toMatchObject({ ok: false });
    expect(checkTrade(withPlayer(state, "beto", { bankrupt: true }), { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 0 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /quebró/ });
    // A one-sided gift of a deed is fine: it is a sale at $0.
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 0 }, receives: NOTHING })).toEqual({ ok: true });
    expect(() => proposeTrade(state, "beto", NOTHING, NOTHING)).toThrow(/al menos una escritura/);
  });

  it("refuses trades either side cannot pay for, fees included", () => {
    const state = table();
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: STARTING_CASH + 1 }, receives: NOTHING })).toMatchObject({ ok: false, reason: /Ana no le alcanza/ });
    expect(checkTrade(state, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 0 }, receives: { deeds: [], cash: STARTING_CASH + 1 } })).toMatchObject({ ok: false, reason: /Beto no le alcanza/ });
    // Ana has exactly the cash she offers; the fee on the mortgaged deed she receives tips her over.
    const broke = withPlayer(state, "ana", { cash: 1_000 });
    const trade = { fromId: "ana", toId: "beto", gives: { deeds: [], cash: 1_000 }, receives: { deeds: ["purmamarca"], cash: 0 } } as const;
    expect(tradeBalance(broke, trade)).toEqual({ from: -1_060, to: 1_000 });
    expect(checkTrade(broke, trade)).toMatchObject({ ok: false, reason: /Ana no le alcanza/ });
    // Incoming cash counts: she can offer more than she has if she gets enough back.
    expect(checkTrade(broke, { fromId: "ana", toId: "beto", gives: { deeds: ["cachi"], cash: 1_000 }, receives: { deeds: [], cash: 500 } })).toEqual({ ok: true });
  });

  it("keeps campos with buildings anywhere in their province off the table", () => {
    let state = withProvince(table(), "ana", JUJUY, 0);
    state = withHolding(state, "tilcara", { ownerId: "ana", chacras: 1 });
    expect(canTradeDeed(state, "tilcara")).toMatchObject({ ok: false, reason: /Vendé las construcciones/ });
    expect(canTradeDeed(state, "humahuaca")).toMatchObject({ ok: false, reason: /construcciones en Jujuy/ });
    expect(canTradeDeed(state, "cachi")).toEqual({ ok: true });
    expect(canTradeDeed(state, "ruta7")).toEqual({ ok: true });
    expect(() => proposeTrade(state, "beto", { deeds: ["humahuaca"], cash: 0 }, NOTHING)).toThrow(/construcciones en Jujuy/);
    state = sellBuilding(state, "tilcara");
    expect(canTradeDeed(state, "humahuaca")).toEqual({ ok: true });
  });

  it("lets a debtor trade for cash during someone else's turn, then pay", () => {
    // Beto owes Carla rent he cannot cover; Ana is on turn.
    let state = game([ANA, BETO, CARLA]);
    state = withHolding(state, "humahuaca", { ownerId: "carla", estancia: true });
    state = withHolding(state, "cachi", { ownerId: "beto" });
    state = withPlayer(state, "beto", { cash: 100 });
    state = { ...state, currentPlayerIndex: 1 };
    state = roll(state, undefined, [1, 1]); // Humahuaca, rent 4.750
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "beto" });
    state = proposeTrade(state, "ana", { deeds: ["cachi"], cash: 0 }, { deeds: [], cash: 5_000 });
    expect(state.phase).toMatchObject({ type: "awaitingTradeResponse", trade: { fromId: "beto", toId: "ana" }, resume: { type: "awaitingPayment", debtorId: "beto" } });
    state = acceptTrade(state);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "beto", amount: 4_750 });
    expect(getPlayer(state, "beto").cash).toBe(5_100);
    state = settlePayment(state);
    expect(getPlayer(state, "carla").cash).toBe(STARTING_CASH + 4_750);
    expect(getPlayer(state, "beto").cash).toBe(350);
    expect(state.holdings["cachi"]?.ownerId).toBe("ana");
  });

  it("resumes whatever step it interrupted: a buy decision, the dice on the table, a card face up", () => {
    let state = withHolding(game(), "cachi", { ownerId: "ana" });
    state = rollDice(state, undefined, [1, 2]);
    expect(state.phase).toEqual({ type: "awaitingMove" });
    // Dice on the table: a rejected trade hands them straight back.
    state = rejectTrade(proposeTrade(state, "beto", { deeds: ["cachi"], cash: 0 }, { deeds: [], cash: 3_000 }));
    expect(state.phase).toEqual({ type: "awaitingMove" });
    state = movePawn(state);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "purmamarca" });
    state = proposeTrade(state, "beto", { deeds: ["cachi"], cash: 0 }, { deeds: [], cash: 3_000 });
    state = acceptTrade(state);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "purmamarca" });
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH + 3_000);
    state = buy(state);
    expect(state.holdings["purmamarca"]?.ownerId).toBe("ana");
    // A card face up: the trade goes through and the card is still there to apply.
    let card = withDecks(withHolding(game(), "cachi", { ownerId: "ana" }), ["suerte-15"], []);
    card = movePawn(rollDice(card, undefined, [4, 6])); // 10: Suerte
    expect(card.phase.type).toBe("awaitingDraw");
    card = cancelTrade(proposeTrade(card, "beto", { deeds: ["cachi"], cash: 0 }, NOTHING));
    expect(card.phase.type).toBe("awaitingDraw");
    card = drawCard(card);
    expect(card.phase).toMatchObject({ type: "awaitingCardAck", card: { id: "suerte-15" } });
    card = acceptTrade(proposeTrade(card, "beto", { deeds: ["cachi"], cash: 0 }, NOTHING));
    expect(card.phase).toMatchObject({ type: "awaitingCardAck", card: { id: "suerte-15" } });
    expect(card.holdings["cachi"]?.ownerId).toBe("beto");
  });

  it("is off limits before the first turn, during auctions and after the game", () => {
    const opening = createGame({ players: [ANA, BETO], random: () => 0.5 });
    expect(() => proposeTrade(opening, "beto", { deeds: [], cash: 0 }, NOTHING)).toThrow(/Terminá la jugada/);
    const auction = decline(roll(game(), undefined, [1, 2]));
    expect(() => proposeTrade(auction, "beto", { deeds: [], cash: 0 }, NOTHING)).toThrow(/remate/);
    const over: GameState = { ...table(), phase: { type: "gameOver", winnerId: "ana" } };
    expect(() => proposeTrade(over, "beto", { deeds: ["cachi"], cash: 0 }, NOTHING)).toThrow(/terminó/);
    expect(() => acceptTrade(table())).toThrow();
    expect(() => rejectTrade(table())).toThrow();
  });
});

describe("voted out", () => {
  const BIRTHDAY = "suerte-06";

  it("returns their deeds free and unbuilt, their cash and jail cards to the bank, and passes their turn", () => {
    let state = game([ANA, BETO, CARLA]);
    state = withProvince(state, "ana", JUJUY, 2);
    state = withHolding(state, "cachi", { ownerId: "ana", mortgaged: true });
    // Ana holds a jail card, so it is out of its deck.
    const jailCard = ALL_CARDS.find((c) => c.effect.type === "getOutOfJail" && c.deck === "suerte")?.id ?? "";
    state = withDecks(state, state.decks.suerte.filter((id) => id !== jailCard), state.decks.yeta);
    state = withPlayer(state, "ana", { getOutOfJailCards: 1, inJail: true });
    const suerteBefore = state.decks.suerte.length;
    state = expelPlayer(state, "ana");
    expect(getPlayer(state, "ana")).toMatchObject({ bankrupt: true, expelled: true, cash: 0, getOutOfJailCards: 0, inJail: false });
    for (const id of [...JUJUY, "cachi" as const]) expect(state.holdings[id]).toBeUndefined();
    expect(state.decks.suerte).toHaveLength(suerteBefore + 1);
    expect(state.decks.suerte.at(-1)).toBe(jailCard);
    expect(state.pendingAuctions).toEqual([]);
    // Ana was on turn: Beto has the dice now, and the replay says what happened, step by step.
    expect(currentPlayer(state).id).toBe("beto");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    const types = state.events.map((e) => e.type);
    expect(types[0]).toBe("bankrupt");
    expect(types.filter((t) => t === "building")).toHaveLength(3);
    expect(types.filter((t) => t === "deed")).toHaveLength(4);
    expect(state.events).toContainEqual(expect.objectContaining({ type: "transfer", amount: STARTING_CASH, to: { type: "bank" } }));
    expect(types.at(-1)).toBe("turn");
    // Nobody waits for Ana again: after Beto comes Carla, then Beto.
    state = endTurn({ ...state, phase: { type: "turnEnd" } });
    expect(currentPlayer(state).id).toBe("carla");
    state = endTurn({ ...state, phase: { type: "turnEnd" } });
    expect(currentPlayer(state).id).toBe("beto");
  });

  it("leaves someone else's turn alone, and ends the game when one player is left", () => {
    let state = game([ANA, BETO, CARLA]);
    state = expelPlayer(state, "carla");
    expect(currentPlayer(state).id).toBe("ana");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    state = expelPlayer(state, "beto");
    expect(state.phase).toEqual({ type: "gameOver", winnerId: "ana" });
    expect(() => expelPlayer(state, "ana")).toThrow(/terminó/);
  });

  it("drops them from the opening throws", () => {
    let state = createGame({ players: [ANA, BETO, CARLA], random: () => 0.5 });
    state = rollDice(state, () => 0.5, [3, 3]);
    // Beto is up next and gone: Carla throws, then the highest of Ana and Carla starts.
    state = expelPlayer(state, "beto");
    expect(state.phase).toEqual({ type: "openingRoll", contenders: ["ana", "carla"], rolls: { ana: 6 } });
    expect(currentPlayer(state).id).toBe("carla");
    state = rollDice(state, () => 0.5, [1, 2]);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).id).toBe("ana");
    // With only one contender left, that one starts.
    let two = createGame({ players: [ANA, BETO, CARLA], random: () => 0.5 });
    two = expelPlayer(expelPlayer(two, "ana"), "beto");
    expect(two.phase).toEqual({ type: "gameOver", winnerId: "carla" });
  });

  it("takes them out of an auction, voiding their bid", () => {
    let state = game([ANA, BETO, CARLA]);
    state = decline(movePawn(rollDice(state, () => 0.5, [2, 3])));
    expect(state.phase.type).toBe("auction");
    state = bid(state, 500); // Beto
    state = expelPlayer(state, "beto");
    expect(state.phase).toMatchObject({ type: "auction", auction: { highestBid: 0, highestBidderId: null, bidders: ["carla", "ana"], turnBidderId: "carla" } });
    state = bid(state, 300); // Carla
    // Ana, whose turn it is, leaves while she is the bidder on turn: Carla, the only one left, wins.
    state = expelPlayer(state, "ana");
    expect(state.phase).toEqual({ type: "gameOver", winnerId: "carla" });
  });

  it("the auction goes on without the player on turn, and their turn passes when it ends", () => {
    let state = game([ANA, BETO, CARLA]);
    state = decline(movePawn(rollDice(state, () => 0.5, [2, 3])));
    state = expelPlayer(state, "ana");
    expect(state.phase).toMatchObject({ type: "auction", auction: { bidders: ["beto", "carla"], turnBidderId: "beto" } });
    state = passBid(bid(state, 400));
    expect(state.holdings["posadas"]?.ownerId).toBe("beto");
    expect(currentPlayer(state).id).toBe("beto");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });

  it("voids a trade they are part of and picks up where the game was", () => {
    let state = game([ANA, BETO, CARLA]);
    state = withHolding(state, "cachi", { ownerId: "ana" });
    state = proposeTrade(state, "beto", { deeds: ["cachi"], cash: 0 }, { deeds: [], cash: 100 });
    state = expelPlayer(state, "beto");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).id).toBe("ana");
    // The proposer leaving voids it too, and their turn passes.
    state = proposeTrade(state, "carla", { deeds: ["cachi"], cash: 0 }, { deeds: [], cash: 0 });
    state = expelPlayer(state, "ana");
    expect(state.phase).toEqual({ type: "gameOver", winnerId: "carla" });
  });

  it("cancels their debts, and a debt owed to them is owed to the bank", () => {
    let state = game([ANA, BETO, CARLA]);
    state = withDecks(state, [BIRTHDAY], []);
    state = withPlayer(state, "beto", { cash: 10 });
    state = withPlayer(state, "carla", { cash: 10 });
    state = { ...state, phase: { type: "awaitingDraw", deck: "suerte" } };
    state = acknowledgeCard(drawCard(state));
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "beto", to: { type: "player", playerId: "ana" } });
    // Ana, who was collecting, leaves: Beto and Carla now owe the bank.
    const creditorGone = expelPlayer(state, "ana");
    expect(creditorGone.phase).toMatchObject({ type: "awaitingPayment", debtorId: "beto", to: { type: "bank" } });
    expect(creditorGone.pendingDebts.every((d) => d.to.type === "bank")).toBe(true);
    // Beto, who owed, leaves: his debt goes with him and Carla's is next.
    const debtorGone = expelPlayer(state, "beto");
    expect(debtorGone.phase).toMatchObject({ type: "awaitingPayment", debtorId: "carla", to: { type: "player", playerId: "ana" } });
    expect(debtorGone.pendingDebts).toHaveLength(1);
  });
});
