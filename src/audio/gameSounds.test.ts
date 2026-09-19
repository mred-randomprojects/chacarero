import { describe, expect, it } from "vitest";
import { buy, createGame, decline, endTurn, mortgage, passBid, roll } from "../game";
import { soundsForTransition } from "./gameSounds";

const players = [
  { id: "a", name: "A", color: "#f00" },
  { id: "b", name: "B", color: "#00f" },
];

describe("soundsForTransition", () => {
  it("plays cash and a card for a roll that draws a paying card", () => {
    let state = createGame({ players, random: () => 0.5 });
    state = { ...state, decks: { suerte: ["suerte-03"], destino: ["destino-01"] }, players: state.players.map((p) => (p.id === "a" ? { ...p, position: 12 } : p)) };
    const next = roll(state, undefined, [1, 2]);
    expect(soundsForTransition(state, next)).toEqual(["cardDraw", "cash"]);
  });

  it("plays the deed sound on a purchase and the gavel on an auction win", () => {
    const start = createGame({ players, random: () => 0.5 });
    const landed = roll(start, undefined, [1, 2]);
    expect(soundsForTransition(landed, buy(landed))).toEqual(["deedBuy"]);
    const auction = decline(landed);
    expect(soundsForTransition(landed, auction)).toEqual(["gavelTap"]);
    const passed = passBid(auction);
    expect(soundsForTransition(auction, passed)).toEqual([]);
  });

  it("plays the turn jingle when the player changes and a mortgage stamp", () => {
    let state = createGame({ players, random: () => 0.5 });
    state = { ...state, holdings: { "formosa-sur": { ownerId: "a", chacras: 0, estancia: false, mortgaged: false } } };
    const mortgaged = mortgage(state, "formosa-sur");
    expect(soundsForTransition(state, mortgaged)).toEqual(["mortgage", "cash"]);
    const ended = endTurn({ ...state, phase: { type: "turnEnd" } });
    expect(soundsForTransition(state, ended)).toEqual(["turn"]);
  });

  it("plays only the fanfare on game over", () => {
    const state = createGame({ players, random: () => 0.5 });
    const over = { ...state, phase: { type: "gameOver" as const, winnerId: "a" } };
    expect(soundsForTransition(state, over)).toEqual(["win"]);
  });
});
