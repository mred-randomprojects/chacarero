import { describe, expect, it } from "vitest";
import type { DeedId } from "../types";
import { JAIL_BAIL, SALIDA_BONUS, STARTING_CASH, TOTAL_CHACRAS, TOTAL_ESTANCIAS } from "../constants";
import type { GameState, Holding, Player } from "./state";
import { activePlayer, createGame, currentPlayer, getPlayer } from "./state";
import {
  MIN_BID_INCREMENT,
  acknowledgeCard,
  bid,
  buildChacra,
  buildEstancia,
  buy,
  chooseDraw,
  choosePay,
  declareBankruptcy,
  decline,
  endTurn,
  mortgage,
  movePawn,
  passBid,
  payBail,
  roll,
  rollDice,
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

  it("declining sends the deed to auction, starting with the next player", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = decline(state);
    expect(state.holdings["formosa-norte"]).toBeUndefined();
    expect(state.phase).toMatchObject({ type: "auction", auction: { deedId: "formosa-norte", highestBid: 0, turnBidderId: "beto", bidders: ["beto", "ana"] } });
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
    state = roll(state, undefined, [1, 3]); // 8: Compañía Petrolera, free
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "petrolera" });
    state = buy(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("sends the player to jail on the third consecutive doubles", () => {
    // First doubles lands on the tax square (4), second on Petrolera (8), third jails.
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

  it("collects from every other player on birthdays, making the broke ones liquidate", () => {
    let state = withDecks(game([ANA, BETO, CARLA]), ["suerte-03"], ["destino-01"]);
    state = withPlayer(state, "carla", { cash: 50 });
    state = withHolding(state, "salta-sur", { ownerId: "carla" });
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]); // -> 10 Destino
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH - 200);
    expect(state.phase).toMatchObject({ type: "awaitingPayment", debtorId: "carla", amount: 200, to: { type: "player", playerId: "ana" } });
    expect(activePlayer(state).id).toBe("carla");
    expect(() => settlePayment(state)).toThrow();
    state = mortgage(state, "salta-sur"); // Carla, the debtor, acts even though it is Ana's turn
    expect(getPlayer(state, "carla").cash).toBe(50 + 1_170);
    state = settlePayment(state);
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH + 400);
    expect(getPlayer(state, "carla").cash).toBe(1_020);
    expect(state.phase).toEqual({ type: "turnEnd" });
    expect(currentPlayer(state).id).toBe("ana");
  });

  it("offers pay-or-draw and resolves either choice", () => {
    let state = withDecks(game(), ["suerte-14"], ["destino-06"]);
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]);
    expect(state.phase).toEqual({ type: "awaitingPayOrDraw", amount: 200, deck: "suerte" });
    const paid = choosePay(state);
    expect(currentPlayer(paid).cash).toBe(STARTING_CASH - 200);
    expect(paid.phase).toEqual({ type: "turnEnd" });
    let drew = chooseDraw(state);
    expect(drew.phase).toMatchObject({ type: "awaitingCardAck", card: { id: "suerte-14" } });
    drew = acknowledgeCard(drew);
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

  it("returns deeds to the bank when the creditor is the bank, which auctions them", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "formosa-sur", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { cash: 100 });
    state = roll(state, undefined, [1, 3]); // tax 5000
    expect(state.phase).toMatchObject({ type: "awaitingPayment", to: { type: "bank" } });
    state = declareBankruptcy(state);
    expect(state.holdings["formosa-sur"]).toBeUndefined();
    expect(state.phase).toMatchObject({ type: "auction", auction: { deedId: "formosa-sur", bidders: ["beto", "carla"], turnBidderId: "beto" } });
    state = bid(state, 300);
    state = passBid(state);
    expect(state.holdings["formosa-sur"]).toMatchObject({ ownerId: "beto", mortgaged: false });
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
    state = withDecks(decline(state), ["suerte-13"], ["destino-04"]);
    state = { ...state, phase: { type: "awaitingRoll" } };
    state = roll(state, undefined, [3, 4]); // 10 Destino -> back to Formosa Sur
    expect(state.lastMove).toEqual({ playerId: "ana", from: 10, to: 1, kind: "backward" });
    state = { ...state, phase: { type: "awaitingRoll" } };
    state = roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]); // 15 Suerte -> jail
    expect(state.lastMove).toEqual({ playerId: "ana", from: 15, to: 14, kind: "jump" });
  });
});

describe("edge cases", () => {
  it("pays the Salida bonus exactly once when landing on it", () => {
    let state = withPlayer(game(), "ana", { position: 38 });
    state = roll(state, undefined, [1, 3]);
    expect(currentPlayer(state).position).toBe(0);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + SALIDA_BONUS);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("does not pay the Salida bonus when moving backwards across it", () => {
    let state = withDecks(game(), ["suerte-04"], ["destino-01"]);
    state = withPlayer(state, "ana", { position: 33 });
    state = roll(state, undefined, [1, 2]); // 36 Suerte -> back 3 = 33
    expect(currentPlayer(state).position).toBe(33);
    state = withDecks(game(), ["suerte-04"], ["destino-01"]);
    state = withPlayer(state, "ana", { position: 12 });
    state = roll(state, undefined, [1, 2]); // 15 -> 12 FC Belgrano
    expect(currentPlayer(state).cash).toBe(STARTING_CASH);
  });

  it("'Siga hasta la Salida' from the last squares pays the bonus", () => {
    let state = withDecks(game(), ["suerte-16"], ["destino-01"]);
    state = withPlayer(state, "ana", { position: 33 });
    state = roll(state, undefined, [1, 2]); // 36 Suerte
    expect(currentPlayer(state).position).toBe(0);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + SALIDA_BONUS);
  });

  it("'Marche preso' by card cancels the extra roll for doubles", () => {
    let state = withDecks(game(), ["suerte-13"], ["destino-01"]);
    state = withPlayer(state, "ana", { position: 11 });
    state = roll(state, undefined, [2, 2]); // 15 Suerte -> jail
    expect(currentPlayer(state).inJail).toBe(true);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("landing on Marche preso with doubles does not roll again", () => {
    let state = withPlayer(game(), "ana", { position: 31 });
    state = roll(state, undefined, [2, 2]);
    expect(currentPlayer(state).inJail).toBe(true);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("refuses to buy what you cannot afford", () => {
    let state = withPlayer(game(), "ana", { cash: 1_000 });
    state = roll(state, undefined, [1, 2]); // Formosa Norte 1.200
    expect(() => buy(state)).toThrow();
    state = decline(state);
    expect(state.phase.type).toBe("auction");
  });

  it("refuses bail without the cash", () => {
    const state: GameState = { ...withPlayer(game(), "ana", { position: 14, inJail: true, cash: 500 }), phase: { type: "awaitingJailDecision" } };
    expect(() => payBail(state)).toThrow();
  });

  it("stops building when the bank runs out of chacras", () => {
    let state = withProvince(game(), "ana", FORMOSA);
    state = { ...state, bank: { chacras: 0, estancias: TOTAL_ESTANCIAS } };
    expect(canBuildChacra(state, currentPlayer(state), "formosa-sur")).toMatchObject({ ok: false });
    expect(() => buildChacra(state, "formosa-sur")).toThrow(/Banco/);
  });

  it("cannot sell an estancia back if the bank cannot hand out four chacras", () => {
    let state = withProvince(game(), "ana", FORMOSA);
    state = FORMOSA.reduce((s, id) => withHolding(s, id, { ownerId: "ana", estancia: true }), state);
    state = { ...state, bank: { chacras: 3, estancias: TOTAL_ESTANCIAS - 3 } };
    expect(() => sellBuilding(state, "formosa-sur")).toThrow(/Banco/);
  });

  it("does not let you build while you owe money you cannot cover, but lets you sell", () => {
    let state = withProvince(game(), "ana", FORMOSA, 1);
    state = withHolding(state, "buenosAires-norte", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { position: 37, cash: 100 });
    state = roll(state, undefined, [1, 2]); // 40 Bs As Norte: 36.000 rent
    expect(state.phase.type).toBe("awaitingPayment");
    expect(() => buildChacra(state, "formosa-sur")).toThrow(/plata/);
    state = sellBuilding(state, "formosa-sur");
    expect(getPlayer(state, "ana").cash).toBe(600);
  });

  it("keeps two get-out-of-jail cards and uses them one at a time", () => {
    let state = withDecks(game(), ["suerte-02"], ["destino-13"]);
    state = roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]); // Suerte
    expect(currentPlayer(state).getOutOfJailCards).toBe(1);
    state = { ...state, phase: { type: "awaitingRoll" } };
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]); // 10 Destino
    expect(currentPlayer(state).getOutOfJailCards).toBe(2);
    expect(state.decks.suerte).toEqual([]);
    expect(state.decks.destino).toEqual([]);
    state = { ...withPlayer(state, "ana", { inJail: true, position: 14 }), phase: { type: "awaitingJailDecision" } };
    state = useJailCard(state);
    expect(currentPlayer(state).getOutOfJailCards).toBe(1);
    expect(state.decks.suerte).toHaveLength(1);
  });

  it("company rent uses the dice that brought you there", () => {
    let state = withHolding(game(), "petrolera", { ownerId: "beto" });
    state = roll(state, undefined, [3, 5]);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 800);
  });

  it("charges rent when a card moves you onto someone's property", () => {
    let state = withDecks(game(), ["suerte-01"], ["destino-01"]);
    state = withHolding(state, "bodega", { ownerId: "beto" });
    state = roll(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]); // Suerte -> Bodega
    expect(currentPlayer(state).position).toBe(16);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 300);
  });

  it("the bankrupt player's creditor inherits mortgaged deeds as mortgaged", () => {
    let state = withHolding(game(), "buenosAires-norte", { ownerId: "beto", estancia: true });
    state = withHolding(state, "formosa-sur", { ownerId: "ana", mortgaged: true });
    state = withHolding(state, "fc-mitre", { ownerId: "ana", mortgaged: true });
    state = withPlayer(state, "ana", { position: 37, cash: 10 });
    state = roll(state, undefined, [1, 2]);
    state = declareBankruptcy(state);
    expect(state.holdings["formosa-sur"]?.mortgaged).toBe(true);
    expect(state.holdings["fc-mitre"]?.ownerId).toBe("beto");
    expect(state.bank.chacras).toBe(TOTAL_CHACRAS);
  });

  it("returns buildings to the bank when a player goes bankrupt", () => {
    let state = withProvince(game(), "ana", FORMOSA, 2);
    state = { ...state, bank: { chacras: TOTAL_CHACRAS - 6, estancias: TOTAL_ESTANCIAS } };
    state = withHolding(state, "buenosAires-norte", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { position: 37, cash: 10 });
    state = roll(state, undefined, [1, 2]);
    // Ana can still sell chacras, so she must do that before bankruptcy.
    expect(() => declareBankruptcy(state)).toThrow();
    for (let i = 0; i < 6; i++) {
      const id = FORMOSA[i % 3];
      if (id) state = sellBuilding(state, id);
    }
    expect(getPlayer(state, "ana").cash).toBe(10 + 6 * 500);
    state = FORMOSA.reduce((s, id) => mortgage(s, id), state);
    expect(() => settlePayment(state)).toThrow();
    state = declareBankruptcy(state);
    expect(state.bank.chacras).toBe(TOTAL_CHACRAS);
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH + 10 + 3_000 + 450 + 450 + 540);
  });

  it("game continues with three players after one goes bankrupt", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "buenosAires-norte", { ownerId: "beto", estancia: true });
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
    let state = withHolding(game([ANA, BETO, CARLA]), "formosa-norte", { ownerId: "beto", estancia: true });
    state = withPlayer(state, "ana", { cash: 10, doublesThisTurn: 1 });
    state = { ...state, rollAgain: true };
    state = roll(state, undefined, [1, 2]); // Formosa Norte: 9.500
    state = declareBankruptcy(state);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("birthday money comes from everyone still playing", () => {
    let state = withDecks(game([ANA, BETO, CARLA]), ["suerte-03"], ["destino-01"]);
    state = withPlayer(state, "carla", { bankrupt: true, cash: 0 });
    state = roll(withPlayer(state, "ana", { position: 7 }), undefined, [1, 2]); // Destino
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH + 200);
    expect(getPlayer(state, "carla").cash).toBe(0);
  });

  it("rent is not charged on a bankrupt player's former deed left with the bank", () => {
    let state = withHolding(game([ANA, BETO, CARLA]), "formosa-centro", { ownerId: "beto", mortgaged: true });
    state = withPlayer(state, "beto", { bankrupt: true });
    expect(rentFor(state, "formosa-centro", "ana", 2)).toBe(0);
  });
});

describe("auctions", () => {
  function auctionFor(players = [ANA, BETO, CARLA]): GameState {
    return decline(roll(game(players), undefined, [1, 2])); // Formosa Norte
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
    expect(state.holdings["formosa-norte"]).toMatchObject({ ownerId: "beto" });
    expect(getPlayer(state, "beto").cash).toBe(STARTING_CASH - 900);
    expect(state.phase).toEqual({ type: "turnEnd" });
  });

  it("leaves the deed with the bank when everyone passes", () => {
    let state = auctionFor();
    state = passBid(passBid(passBid(state)));
    expect(state.holdings["formosa-norte"]).toBeUndefined();
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
    expect(state.holdings["formosa-norte"]).toMatchObject({ ownerId: "ana" });
    expect(getPlayer(state, "ana").cash).toBe(STARTING_CASH - 100);
  });

  it("does not allow building or mortgaging during an auction", () => {
    let state = withHolding(game(), "salta-sur", { ownerId: "ana" });
    state = decline(roll(state, undefined, [1, 2]));
    expect(() => mortgage(state, "salta-sur")).toThrow(/remate/);
  });

  it("keeps the doubles re-roll after an auction", () => {
    let state = roll(game([ANA, BETO]), undefined, [1, 1]); // Formosa Centro, doubles
    state = decline(state);
    state = passBid(passBid(state));
    expect(state.phase).toEqual({ type: "awaitingRoll" });
    expect(currentPlayer(state).id).toBe("ana");
  });
});

describe("three doubles clawback", () => {
  it("returns what the bank paid this turn when the third doubles sends you to jail", () => {
    let state = withPlayer(game(), "ana", { position: 41 });
    state = roll(state, undefined, [1, 1]); // passes Salida: +5000, lands on Formosa Sur
    state = buy(state);
    expect(currentPlayer(state).cash).toBe(STARTING_CASH + 5_000 - 1_000);
    state = roll(state, undefined, [3, 3]); // 7: Premio ganadero +2500
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
    let state = withHolding(game(), "formosa-centro", { ownerId: "ana" });
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
  it("spells out the dice and multiplier in the log", () => {
    let state = withHolding(game(), "petrolera", { ownerId: "beto" });
    state = roll(state, undefined, [3, 5]);
    expect(state.log.at(-1)?.text).toContain("dados 3+5 = 8 × 100");
  });
});

describe("moves per action", () => {
  it("splits a turn into roll, move and card steps, each with its own moves and events", () => {
    let state = withDecks(game(), ["suerte-04"], ["destino-01"]);
    state = rollDice(withPlayer(state, "ana", { position: 12 }), undefined, [1, 2]);
    expect(state.phase).toEqual({ type: "awaitingMove" });
    expect(state.moves).toEqual([]);
    expect(state.events.map((e) => e.type)).toEqual(["log"]);
    state = movePawn(state); // 15 Suerte
    expect(state.moves).toEqual([{ playerId: "ana", from: 12, to: 15, kind: "forward" }]);
    expect(state.phase).toMatchObject({ type: "awaitingCardAck", card: { id: "suerte-04" } });
    expect(state.events.map((e) => e.type)).toEqual(["move", "log", "card"]);
    state = acknowledgeCard(state); // back 3 = 12, FC Belgrano free
    expect(state.moves).toEqual([{ playerId: "ana", from: 15, to: 12, kind: "backward" }]);
    expect(currentPlayer(state).position).toBe(12);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "fc-belgrano" });
  });

  it("emits a transfer and a deed event on purchase", () => {
    let state = roll(game(), undefined, [1, 2]);
    state = buy(state);
    expect(state.events.map((e) => e.type)).toEqual(["transfer", "deed"]);
    expect(state.events[0]).toMatchObject({ type: "transfer", from: { type: "player", playerId: "ana" }, to: { type: "bank" }, amount: 1_200 });
    expect(state.events[1]).toMatchObject({ type: "deed", deedId: "formosa-norte", to: { type: "player", playerId: "ana" } });
  });

  it("emits the Salida bonus as a transfer from the bank", () => {
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
