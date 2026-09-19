import { describe, expect, it } from "vitest";
import type { DeedId } from "../types";
import { JAIL_BAIL, SALIDA_BONUS, STARTING_CASH, TOTAL_CHACRAS, TOTAL_ESTANCIAS } from "../constants";
import type { GameState, Holding, Player } from "./state";
import { createGame, currentPlayer, getPlayer } from "./state";
import {
  buildChacra,
  buildEstancia,
  buy,
  chooseDraw,
  choosePay,
  declareBankruptcy,
  decline,
  endTurn,
  mortgage,
  payBail,
  roll,
  sellBuilding,
  settlePayment,
  unmortgage,
  useJailCard,
} from "./actions";
import { canBuildChacra, mortgageProceeds, rentFor, unmortgageCost } from "./rules";

const ANA = { id: "ana", name: "Ana", color: "#f00" };
const BETO = { id: "beto", name: "Beto", color: "#00f" };
const CARLA = { id: "carla", name: "Carla", color: "#0f0" };

function game(players = [ANA, BETO]): GameState {
  return createGame({ players, random: () => 0.5 });
}

function withPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function withHolding(state: GameState, deedId: DeedId, holding: Partial<Holding> & { ownerId: string }): GameState {
  return { ...state, holdings: { ...state.holdings, [deedId]: { chacras: 0, estancia: false, mortgaged: false, ...holding } } };
}

function withDecks(state: GameState, suerte: readonly string[], destino: readonly string[]): GameState {
  return { ...state, decks: { suerte, destino } };
}

/** Gives a player every zone of a province. */
function withProvince(state: GameState, ownerId: string, ids: readonly DeedId[], chacras = 0): GameState {
  return ids.reduce((s, id) => withHolding(s, id, { ownerId, chacras }), state);
}

const FORMOSA: readonly DeedId[] = ["formosa-sur", "formosa-centro", "formosa-norte"];

describe("createGame", () => {
  it("starts everyone on Salida with the starting cash", () => {
    const state = game();
    expect(state.players).toHaveLength(2);
    for (const p of state.players) {
      expect(p.cash).toBe(STARTING_CASH);
      expect(p.position).toBe(0);
    }
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(state.decks.suerte).toHaveLength(16);
    expect(state.decks.destino).toHaveLength(16);
    expect(state.bank).toEqual({ chacras: TOTAL_CHACRAS, estancias: TOTAL_ESTANCIAS });
  });

  it("rejects fewer than 2 or more than 6 players", () => {
    expect(() => createGame({ players: [ANA] })).toThrow();
    expect(() => createGame({ players: Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: "x", color: "#000" })) })).toThrow();
    expect(() => createGame({ players: [ANA, ANA] })).toThrow();
  });
});

describe("rolling and buying", () => {
  it("moves the player and offers a free deed", () => {
    const state = roll(game(), undefined, [1, 2]);
    expect(currentPlayer(state).position).toBe(3);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "formosa-norte" });
  });

  it("buying transfers the deed and ends the turn", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = buy(state);
    expect(state.holdings["formosa-norte"]).toEqual({ ownerId: "ana", chacras: 0, estancia: false, mortgaged: false });
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 1_200);
    expect(state.phase).toEqual({ type: "turnEnd" });
    state = endTurn(state);
    expect(currentPlayer(state).id).toBe("beto");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(state.turn).toBe(2);
  });

  it("declining leaves the deed with the bank", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = decline(state);
    expect(state.holdings["formosa-norte"]).toBeUndefined();
    expect(state.phase).toEqual({ type: "turnEnd" });
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
    state = roll(state, undefined, [1, 3]); // 8: Compañía Petrolera, free
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "petrolera" });
    state = decline(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("sends the player to jail on the third consecutive doubles", () => {
    // First doubles lands on the tax square (4), second on Petrolera (8), third jails.
    let state = roll(game(), undefined, [2, 2]);
    expect(currentPlayer(state).position).toBe(4);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    state = roll(state, undefined, [2, 2]);
    expect(currentPlayer(state).position).toBe(8);
    state = decline(state);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    state = roll(state, undefined, [3, 3]);
    const ana = currentPlayer(state);
    expect(ana.inJail).toBe(true);
    expect(ana.position).toBe(14);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });
});

describe("special squares", () => {
  it("pays the Salida bonus when passing it", () => {
    let state = withPlayer(game(), "ana", { position: 40 });
    state = roll(state, undefined, [1, 2]);
    expect(currentPlayer(state).position).toBe(1);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + SALIDA_BONUS);
  });

  it("charges taxes and pays prizes", () => {
    let state = roll(game(), undefined, [1, 3]);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 5_000);
    expect(state.phase).toEqual({ type: "turnEnd" });
    state = roll(withPlayer(game(), "ana", { position: 0 }), undefined, [3, 4]);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 2_500);
  });

  it("Marche preso puts the player in the Comisaría without the Salida bonus", () => {
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
    state = decline(state);
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
    state = withDecks(state, state.decks.suerte.filter((id) => id !== "suerte-02"), state.decks.destino);
    state = useJailCard(state);
    expect(currentPlayer(state).inJail).toBe(false);
    expect(currentPlayer(state).getOutOfJailCards).toBe(0);
    expect(state.decks.suerte.at(-1)).toBe("suerte-02");
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });
});

describe("rent", () => {
  it("collects the bare rent for an owned campo", () => {
    let state = withHolding(game(), "formosa-centro", { ownerId: "beto" });
    state = roll(state, undefined, [1, 1]);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 40);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 40);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });

  it("scales railway rent with the number owned and company rent with the dice", () => {
    let state = withHolding(game(), "fc-belgrano", { ownerId: "beto" });
    expect(rentFor(state, "fc-belgrano", "ana", 7)).toBe(500);
    state = withHolding(state, "fc-mitre", { ownerId: "beto" });
    expect(rentFor(state, "fc-belgrano", "ana", 7)).toBe(1_000);
    state = withHolding(state, "petrolera", { ownerId: "beto" });
    expect(rentFor(state, "petrolera", "ana", 7)).toBe(700);
    state = withHolding(state, "bodega", { ownerId: "beto" });
    expect(rentFor(state, "petrolera", "ana", 7)).toBe(1_400);
  });

  it("charges nothing when the owner is in jail, the deed is mortgaged, or it is yours", () => {
    let state = withHolding(game(), "formosa-centro", { ownerId: "beto" });
    expect(rentFor(withPlayer(state, "beto", { inJail: true }), "formosa-centro", "ana", 2)).toBe(0);
    expect(rentFor(withHolding(state, "formosa-centro", { ownerId: "beto", mortgaged: true }), "formosa-centro", "ana", 2)).toBe(0);
    expect(rentFor(state, "formosa-centro", "beto", 2)).toBe(0);
    state = withPlayer(state, "beto", { inJail: true });
    state = roll(state, undefined, [1, 1]);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH);
  });

  it("uses the building ladder", () => {
    const state = withHolding(game(), "formosa-centro", { ownerId: "beto", chacras: 3 });
    expect(rentFor(state, "formosa-centro", "ana", 2)).toBe(1_700);
    expect(rentFor(withHolding(state, "formosa-centro", { ownerId: "beto", estancia: true }), "formosa-centro", "ana", 2)).toBe(4_750);
  });
});

describe("cards", () => {
  function onSuerte(state: GameState): GameState {
    return roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]);
  }

  it("collects money and rotates the card to the bottom", () => {
    let state = withDecks(game(), ["suerte-03", "suerte-06"], ["destino-01"]);
    state = onSuerte(state);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 3_000);
    expect(state.decks.suerte).toEqual(["suerte-06", "suerte-03"]);
    expect(state.lastCard?.id).toBe("suerte-03");
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("keeps a get-out-of-jail card", () => {
    let state = withDecks(game(), ["suerte-02", "suerte-06"], ["destino-01"]);
    state = onSuerte(state);
    expect(currentPlayer(state).getOutOfJailCards).toBe(1);
    expect(state.decks.suerte).toEqual(["suerte-06"]);
  });

  it("moves forward, collecting Salida when the card says so", () => {
    let state = withDecks(game(), ["suerte-08"], ["destino-01"]);
    state = withPlayer(state, "ana", { position: 33 });
    state = roll(state, undefined, [1, 2]); // -> 36 Suerte
    expect(currentPlayer(state).position).toBe(13);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + SALIDA_BONUS);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "salta-norte" });
  });

  it("moves back three squares without the Salida bonus", () => {
    let state = withDecks(game(), ["suerte-04"], ["destino-01"]);
    state = withHolding(state, "fc-belgrano", { ownerId: "beto" });
    state = onSuerte(state); // 15 -> 12 FC Belgrano
    expect(currentPlayer(state).position).toBe(12);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 500);
  });

  it("sends the player to jail", () => {
    let state = withDecks(game(), ["suerte-13"], ["destino-01"]);
    state = onSuerte(state);
    expect(currentPlayer(state).inJail).toBe(true);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("charges per building", () => {
    let state = withDecks(game(), ["suerte-15"], ["destino-01"]);
    state = withProvince(state, "ana", FORMOSA, 2);
    state = withHolding(state, "formosa-norte", { ownerId: "ana", estancia: true });
    state = onSuerte(state);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - (4 * 500 + 2_500));
  });

  it("collects from every other player on birthdays", () => {
    let state = withDecks(game([ANA, BETO, CARLA]), ["suerte-03"], ["destino-01"]);
    state = withPlayer(state, "carla", { cash: 50 });
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]); // -> 10 Destino
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH + 200 + 50);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH - 200);
    expect(getPlayer(state, "carla").cash).toBe(0);
  });

  it("offers pay-or-draw and resolves either choice", () => {
    let state = withDecks(game(), ["suerte-14"], ["destino-06"]);
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]);
    expect(state.phase).toEqual({ type: "awaitingPayOrDraw", amount: 200, deck: "suerte" });
    const paid = choosePay(state);
    expect(currentPlayer(paid).cash).toBe(STARTING_CASH - 200);
    expect(paid.phase).toEqual({ type: "turnEnd" });
    const drew = chooseDraw(state);
    expect(currentPlayer(drew).cash).toBe(STARTING_CASH + 10_000);
  });
});

describe("building", () => {
  it("requires the whole province and builds evenly", () => {
    let state = withHolding(game(), "formosa-sur", { ownerId: "ana" });
    expect(canBuildChacra(state, currentPlayer(state), "formosa-sur").ok).toBe(false);
    state = withProvince(state, "ana", FORMOSA);
    state = buildChacra(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]?.chacras).toBe(1);
    expect(state.bank.chacras).toBe(TOTAL_CHACRAS - 1);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 1_000);
    expect(() => buildChacra(state, "formosa-sur")).toThrow(/parejo/);
    state = buildChacra(buildChacra(state, "formosa-centro"), "formosa-norte");
    state = buildChacra(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]?.chacras).toBe(2);
  });

  it("upgrades four chacras to an estancia and sells buildings at half price", () => {
    let state = withProvince(game(), "ana", FORMOSA, 4);
    state = { ...state, bank: { chacras: TOTAL_CHACRAS - 12, estancias: TOTAL_ESTANCIAS } };
    state = buildEstancia(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]).toMatchObject({ chacras: 0, estancia: true });
    expect(state.bank).toEqual({ chacras: TOTAL_CHACRAS - 8, estancias: TOTAL_ESTANCIAS - 1 });
    expect(() => sellBuilding(state, "formosa-centro")).toThrow(/parejo/);
    state = sellBuilding(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]).toMatchObject({ chacras: 4, estancia: false });
    expect(currentPlayer(state).cash).toBe(STARTING_CASH - 1_000 + 500);
    state = sellBuilding(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]?.chacras).toBe(3);
  });

  it("does not allow building on a province with a mortgaged zone", () => {
    let state = withProvince(game(), "ana", FORMOSA);
    state = withHolding(state, "formosa-norte", { ownerId: "ana", mortgaged: true });
    expect(canBuildChacra(state, currentPlayer(state), "formosa-sur")).toMatchObject({ ok: false });
  });
});

describe("mortgages", () => {
  it("pays out 90 % of the mortgage value and costs 110 % to lift", () => {
    expect(mortgageProceeds("formosa-sur")).toBe(450);
    expect(unmortgageCost("formosa-sur")).toBe(550);
    let state = withHolding(game(), "formosa-sur", { ownerId: "ana" });
    state = mortgage(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]?.mortgaged).toBe(true);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 450);
    expect(() => mortgage(state, "formosa-sur")).toThrow();
    state = unmortgage(state, "formosa-sur");
    expect(state.holdings["formosa-sur"]?.mortgaged).toBe(false);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 450 - 550);
  });

  it("refuses to mortgage a built campo", () => {
    const state = withHolding(game(), "formosa-sur", { ownerId: "ana", chacras: 1 });
    expect(() => mortgage(state, "formosa-sur")).toThrow();
  });
});

describe("debts and bankruptcy", () => {
  it("waits for the player to raise cash, then settles", () => {
    let state = withHolding(game(), "formosa-centro", { ownerId: "beto", estancia: true });
    state = withHolding(state, "salta-sur", { ownerId: "ana" });
    state = withPlayer(state, "ana", { cash: 4_000 });
    state = roll(state, undefined, [1, 1]);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", amount: 4_750 });
    expect(() => settlePayment(state)).toThrow();
    expect(() => declareBankruptcy(state)).toThrow(/vender o hipotecar/);
    state = mortgage(state, "salta-sur");
    state = settlePayment(state);
    expect(getPlayer(state, "ana").cash).toBe(4_000 + 1_170 - 4_750);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 4_750);
    expect(state.phase).toEqual({ type: "awaitingRoll" });
  });

  it("hands everything to the creditor and ends the game with two players", () => {
    let state = withHolding(game(), "formosa-centro", { ownerId: "beto", estancia: true });
    state = withHolding(state, "salta-sur", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { cash: 100, getOutOfJailCards: 1 });
    state = roll(state, undefined, [1, 1]);
    expect(state.phase.type).toBe("awaitingPayment");
    state = declareBankruptcy(state);
    expect(getPlayer(state, "ana").bankrupt).toBe(true);
    expect(getPlayer(state, "ana").cash).toBe(0);
    expect(state.holdings["salta-sur"]).toEqual({ ownerId: "beto", chacras: 0, estancia: false, mortgaged: true });
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 100);
    expect(getPlayer(state, "beto").getOutOfJailCards).toBe(1);
    state = endTurn(state);
    expect(state.phase).toEqual({ type: "gameOver", winnerId: "beto" });
  });

  it("returns deeds to the bank when the creditor is the bank", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "formosa-sur", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { cash: 100 });
    state = roll(state, undefined, [1, 3]); // tax 5000
    expect(state.phase).toMatchObject({ type: "awaitingPayment", to: { type: "bank" } });
    state = declareBankruptcy(state);
    expect(state.holdings["formosa-sur"]).toBeUndefined();
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
