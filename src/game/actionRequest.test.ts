import { describe, expect, it } from "vitest";
import { allowedPlayerFor, applyActionRequest } from "./actionRequest";
import { createGame, decline, proposeTrade, roll } from "./engine";
import type { GameState } from "./engine";
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

describe("trades", () => {
  const offer = { deeds: ["salta-sur" as const], cash: 0 };
  const nothing = { deeds: [], cash: 500 };

  function pending(): GameState {
    const state: GameState = { ...createGame({ players, random: () => 0.5 }), holdings: { "salta-sur": { ownerId: "a", chacras: 0, estancia: false, mortgaged: false } } };
    return proposeTrade(state, "b", offer, nothing);
  }

  it("lets the player who must act propose, and only the two parties answer", () => {
    const start = { ...createGame({ players, random: () => 0.5 }), holdings: { "salta-sur": { ownerId: "a", chacras: 0, estancia: false, mortgaged: false } } };
    expect(allowedPlayerFor(start, { type: "proposeTrade", toId: "b", gives: offer, receives: nothing })).toBe("a");
    expect(allowedPlayerFor(start, { type: "acceptTrade" })).toBeNull();
    // Building is fine with the dice in the air; proposing a trade waits for the pawn.
    const rolled = applyActionRequest(start, { type: "rollDice" }, [1, 2]);
    expect(allowedPlayerFor(rolled, { type: "mortgage", deedId: "salta-sur" })).toBe("a");
    expect(allowedPlayerFor(rolled, { type: "proposeTrade", toId: "b", gives: offer, receives: nothing })).toBeNull();
    const state = pending();
    expect(allowedPlayerFor(state, { type: "acceptTrade" })).toBe("b");
    expect(allowedPlayerFor(state, { type: "rejectTrade" })).toBe("b");
    expect(allowedPlayerFor(state, { type: "counterTrade", gives: nothing, receives: offer })).toBe("b");
    expect(allowedPlayerFor(state, { type: "cancelTrade" })).toBe("a");
    // Everything else waits, including the proposer's own turn actions.
    expect(allowedPlayerFor(state, { type: "rollDice" })).toBeNull();
    expect(allowedPlayerFor(state, { type: "mortgage", deedId: "salta-sur" })).toBeNull();
    expect(allowedPlayerFor(state, { type: "proposeTrade", toId: "c", gives: offer, receives: nothing })).toBeNull();
  });

  it("gets a clock and is rejected by default", () => {
    const state = pending();
    expect(phaseSeconds(state)).toBe(45);
    expect(defaultAction(state)).toEqual({ type: "rejectTrade" });
    const resumed = applyActionRequest(state, { type: "rejectTrade" });
    expect(resumed.phase).toEqual({ type: "awaitingRoll" });
    const accepted = applyActionRequest(state, { type: "acceptTrade" });
    expect(accepted.holdings["salta-sur"]?.ownerId).toBe("b");
    expect(accepted.players.find((p) => p.id === "a")?.cash).toBe(35_000 + 500);
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
