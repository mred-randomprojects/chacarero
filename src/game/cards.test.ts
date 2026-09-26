import { describe, expect, it } from "vitest";
import { ALL_CARDS, YETA_CARDS, SUERTE_CARDS, shuffledDeck } from "./cards";
import { SQUARES } from "./board";

describe("card decks", () => {
  it("has 16 cards per deck with unique ids", () => {
    expect(SUERTE_CARDS).toHaveLength(16);
    expect(YETA_CARDS).toHaveLength(16);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(32);
    for (const card of SUERTE_CARDS) expect(card.deck).toBe("suerte");
    for (const card of YETA_CARDS) expect(card.deck).toBe("yeta");
  });

  it("only moves players to real squares", () => {
    for (const card of ALL_CARDS) {
      if (card.effect.type === "moveTo") {
        expect(SQUARES[card.effect.square]).toBeDefined();
      }
    }
  });

  it("names the destination square in the card text", () => {
    const names: Record<number, string> = { 0: "Tranquera", 1: "Tilcara", 13: "Salta", 16: "Frigorífico", 26: "Mendoza", 40: "Mar del Plata" };
    for (const card of ALL_CARDS) {
      if (card.effect.type !== "moveTo") continue;
      expect(card.text).toContain(names[card.effect.square]);
    }
  });

  it("has one get-out-of-jail card per deck, and both go-to-jail cards in Yeta", () => {
    for (const deck of [SUERTE_CARDS, YETA_CARDS]) {
      expect(deck.filter((c) => c.effect.type === "getOutOfJail")).toHaveLength(1);
    }
    expect(SUERTE_CARDS.filter((c) => c.effect.type === "goToJail")).toHaveLength(0);
    expect(YETA_CARDS.filter((c) => c.effect.type === "goToJail")).toHaveLength(2);
  });

  it("keeps Suerte mostly good and Yeta mostly bad: 13 to 3 each way", () => {
    const good = (card: (typeof ALL_CARDS)[number]) =>
      card.effect.type === "collect" ||
      card.effect.type === "collectFromEachPlayer" ||
      card.effect.type === "getOutOfJail" ||
      (card.effect.type === "moveTo" && card.effect.square === 0);
    expect(SUERTE_CARDS.filter(good)).toHaveLength(13);
    expect(YETA_CARDS.filter(good)).toHaveLength(3);
    for (const card of YETA_CARDS.filter(good)) expect(card.text).toMatch(/^¡Zafaste!/);
  });

  it("mentions the amount in every money card", () => {
    for (const card of ALL_CARDS) {
      const { effect } = card;
      if (effect.type === "collect" || effect.type === "pay" || effect.type === "collectFromEachPlayer" || effect.type === "payOrDraw") {
        expect(card.text).toContain(`$${effect.amount.toLocaleString("es-AR")}`);
      }
    }
  });
});

describe("shuffledDeck", () => {
  it("returns every card exactly once", () => {
    const deck = shuffledDeck("suerte");
    expect(deck.map((c) => c.id).sort()).toEqual(SUERTE_CARDS.map((c) => c.id).sort());
  });

  it("is deterministic for a fixed random source", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const a = shuffledDeck("yeta", random).map((c) => c.id);
    seed = 7;
    const b = shuffledDeck("yeta", random).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(YETA_CARDS.map((c) => c.id));
  });
});
