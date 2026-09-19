import { describe, expect, it } from "vitest";
import { ALL_CARDS, DESTINO_CARDS, SUERTE_CARDS, shuffledDeck } from "./cards";
import { SQUARES } from "./board";

describe("card decks", () => {
  it("has 16 cards per deck with unique ids", () => {
    expect(SUERTE_CARDS).toHaveLength(16);
    expect(DESTINO_CARDS).toHaveLength(16);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(32);
    for (const card of SUERTE_CARDS) expect(card.deck).toBe("suerte");
    for (const card of DESTINO_CARDS) expect(card.deck).toBe("destino");
  });

  it("only moves players to real squares", () => {
    for (const card of ALL_CARDS) {
      if (card.effect.type === "moveTo") {
        expect(SQUARES[card.effect.square]).toBeDefined();
      }
    }
  });

  it("names the destination square in the card text", () => {
    const names: Record<number, string> = { 0: "Salida", 1: "Formosa", 13: "Salta", 16: "Bodega", 26: "Santa Fe", 40: "Buenos Aires" };
    for (const card of ALL_CARDS) {
      if (card.effect.type !== "moveTo") continue;
      expect(card.text).toContain(names[card.effect.square]);
    }
  });

  it("has one get-out-of-jail card and one go-to-jail card per deck", () => {
    for (const deck of [SUERTE_CARDS, DESTINO_CARDS]) {
      expect(deck.filter((c) => c.effect.type === "getOutOfJail")).toHaveLength(1);
      expect(deck.filter((c) => c.effect.type === "goToJail")).toHaveLength(1);
    }
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
    const a = shuffledDeck("destino", random).map((c) => c.id);
    seed = 7;
    const b = shuffledDeck("destino", random).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(DESTINO_CARDS.map((c) => c.id));
  });
});
