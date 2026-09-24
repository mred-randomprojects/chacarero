import { describe, expect, it } from "vitest";
import type { DeedId, Holding } from "../game";
import { deedSlot, seatDeeds } from "./deedSlots";

const held = (ownerId: string): Holding => ({ ownerId, chacras: 0, estancia: false, mortgaged: false });

describe("seat deed layout", () => {
  it("keeps a slot free for a card flying in, in board order, so it lands where it will stay", () => {
    const holdings: Partial<Record<DeedId, Holding>> = { "formosa-sur": held("p1"), "rioNegro-sur": held("p1"), "salta-sur": held("p2") };
    const laid = seatDeeds(holdings, "p1", new Set<DeedId>(["formosa-centro"]), new Set());
    expect(laid).toEqual(["formosa-sur", "formosa-centro", "rioNegro-sur"]);
    // The incoming card's slot while flying is the slot it keeps once the table says it is owned.
    const after = seatDeeds({ ...holdings, "formosa-centro": held("p1") }, "p1", new Set(), new Set());
    expect(after).toEqual(laid);
    expect(deedSlot(laid.indexOf("formosa-centro"), laid.length)).toEqual(deedSlot(after.indexOf("formosa-centro"), after.length));
  });

  it("drops a card flying away, so the others close up while it flies", () => {
    const holdings: Partial<Record<DeedId, Holding>> = { "formosa-sur": held("p1"), "rioNegro-sur": held("p1") };
    expect(seatDeeds(holdings, "p1", new Set(), new Set<DeedId>(["formosa-sur"]))).toEqual(["rioNegro-sur"]);
  });

  it("centres each row", () => {
    expect(deedSlot(0, 1).right).toBeCloseTo(0);
    expect(deedSlot(0, 2).right).toBeCloseTo(-deedSlot(1, 2).right);
    expect(deedSlot(8, 9).right).toBeCloseTo(0);
    expect(deedSlot(8, 9).up).toBeLessThan(deedSlot(0, 9).up);
  });
});
