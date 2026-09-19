import { describe, expect, it } from "vitest";
import { allowedPlayerFor, applyActionRequest } from "./actionRequest";
import { createGame, decline, roll } from "./engine";
import { autoResolveDebt, defaultAction, phaseSeconds, replaySeconds } from "./timing";

const players = [
  { id: "a", name: "A", color: "#f00" },
  { id: "b", name: "B", color: "#00f" },
  { id: "c", name: "C", color: "#0f0" },
];

describe("allowedPlayerFor", () => {
  it("only lets the player on turn roll, and the bidder on turn bid", () => {
    let state = createGame({ players, random: () => 0.5 });
    expect(allowedPlayerFor(state, { type: "rollDice" })).toBe("a");
    expect(allowedPlayerFor(state, { type: "buy" })).toBeNull();
    state = decline(roll(state, undefined, [1, 2]));
    expect(allowedPlayerFor(state, { type: "bid", amount: 100 })).toBe("b");
    expect(allowedPlayerFor(state, { type: "mortgage", deedId: "formosa-sur" })).toBeNull();
  });

  it("lets the debtor act during someone else's turn", () => {
    let state = createGame({ players, random: () => 0.5 });
    state = { ...state, holdings: { "formosa-norte": { ownerId: "b", chacras: 0, estancia: true, mortgaged: false } }, players: state.players.map((p) => (p.id === "a" ? { ...p, cash: 10 } : p)) };
    state = roll(state, undefined, [1, 2]);
    expect(state.phase.type).toBe("awaitingPayment");
    expect(allowedPlayerFor(state, { type: "settlePayment" })).toBe("a");
    expect(allowedPlayerFor(state, { type: "sellBuilding", deedId: "formosa-sur" })).toBe("a");
  });
});

describe("applyActionRequest", () => {
  it("routes every request to the engine with the supplied dice", () => {
    let state = createGame({ players, random: () => 0.5 });
    state = applyActionRequest(state, { type: "rollDice" }, [2, 3]);
    expect(state.dice).toEqual([2, 3]);
    expect(state.phase).toEqual({ type: "awaitingMove" });
    state = applyActionRequest(state, { type: "movePawn" });
    expect(state.players[0]?.position).toBe(5);
    expect(state.phase).toEqual({ type: "awaitingBuyDecision", deedId: "rioNegro-sur" });
    state = applyActionRequest(state, { type: "buy" });
    expect(state.holdings["rioNegro-sur"]?.ownerId).toBe("a");
  });
});

describe("timing", () => {
  it("gives every phase but game over a clock and a default", () => {
    const state = createGame({ players, random: () => 0.5 });
    expect(phaseSeconds(state)).toBe(30);
    expect(defaultAction(state)).toEqual({ type: "rollDice" });
    const over = { ...state, phase: { type: "gameOver" as const, winnerId: "a" } };
    expect(phaseSeconds(over)).toBeNull();
    expect(defaultAction(over)).toBeNull();
  });

  it("sums replay time from the events, scaled", () => {
    const state = roll(createGame({ players, random: () => 0.5 }), undefined, [1, 2]);
    const seconds = replaySeconds(state.events);
    expect(seconds).toBeGreaterThan(2);
    expect(replaySeconds(state.events, 2)).toBeCloseTo(seconds * 2, 6);
  });

  it("auto-resolves a debt by selling, mortgaging, then paying or busting", () => {
    let state = createGame({ players, random: () => 0.5 });
    state = {
      ...state,
      holdings: {
        "formosa-norte": { ownerId: "b", chacras: 0, estancia: true, mortgaged: false },
        "salta-sur": { ownerId: "a", chacras: 0, estancia: false, mortgaged: false },
        "salta-centro": { ownerId: "a", chacras: 0, estancia: false, mortgaged: false },
        "salta-norte": { ownerId: "a", chacras: 2, estancia: false, mortgaged: false },
      },
      players: state.players.map((p) => (p.id === "a" ? { ...p, cash: 7_000 } : p)),
    };
    state = roll(state, undefined, [1, 2]); // rent 9.500
    expect(state.phase.type).toBe("awaitingPayment");
    const resolved = autoResolveDebt(state);
    expect(resolved.phase.type).not.toBe("awaitingPayment");
    expect(resolved.players[1]?.cash).toBe(35_000 + 9_500);
    const broke = { ...state, holdings: { "formosa-norte": state.holdings["formosa-norte"] } as typeof state.holdings, players: state.players.map((p) => (p.id === "a" ? { ...p, cash: 10 } : p)) };
    const bust = autoResolveDebt(broke);
    expect(bust.players[0]?.bankrupt).toBe(true);
  });
});
