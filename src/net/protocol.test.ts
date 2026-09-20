import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./protocol";

const playerId = "ana-00000001";

describe("parseClientMessage", () => {
  it("accepts a trade proposal with deeds and cash on both sides", () => {
    const message = parseClientMessage(
      JSON.stringify({
        type: "action",
        playerId,
        seq: 3,
        action: { type: "proposeTrade", toId: "beto-0000001", gives: { deeds: ["salta-sur", "fc-mitre"], cash: 500 }, receives: { deeds: [], cash: 0 } },
      }),
    );
    expect(message).toMatchObject({ type: "action", seq: 3, action: { type: "proposeTrade", toId: "beto-0000001", gives: { deeds: ["salta-sur", "fc-mitre"], cash: 500 } } });
  });

  it("rejects unknown deeds, fractional or negative cash, and malformed payloads", () => {
    const action = (payload: unknown) => parseClientMessage(JSON.stringify({ type: "action", playerId, seq: 0, action: payload }));
    expect(action({ type: "proposeTrade", toId: "beto-0000001", gives: { deeds: ["narnia"], cash: 0 }, receives: { deeds: [], cash: 0 } })).toBeNull();
    expect(action({ type: "proposeTrade", toId: "beto-0000001", gives: { deeds: [], cash: 10.5 }, receives: { deeds: [], cash: 0 } })).toBeNull();
    expect(action({ type: "counterTrade", gives: { deeds: [], cash: -1 }, receives: { deeds: [], cash: 0 } })).toBeNull();
    expect(action({ type: "acceptTrade" })).toMatchObject({ action: { type: "acceptTrade" } });
    expect(parseClientMessage("{not json")).toBeNull();
  });
});

describe("startGame", () => {
  it("defaults to dealing no deeds and caps the deal", () => {
    expect(parseClientMessage(JSON.stringify({ type: "startGame", playerId, startingCash: 35_000 }))).toMatchObject({ type: "startGame", startingCash: 35_000, dealDeeds: 0 });
    expect(parseClientMessage(JSON.stringify({ type: "startGame", playerId, startingCash: 35_000, dealDeeds: 3 }))).toMatchObject({ dealDeeds: 3 });
    expect(parseClientMessage(JSON.stringify({ type: "startGame", playerId, startingCash: 35_000, dealDeeds: 9 }))).toBeNull();
  });
});
