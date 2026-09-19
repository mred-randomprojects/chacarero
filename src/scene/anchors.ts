import { Vector3 } from "three";
import type { Party } from "../game";
import type { HexLayout, Vec2 } from "./hexLayout";
import type { SeatFrame } from "./seats";
import { seatFrame, seatPoint } from "./seats";
import { boardToWorld } from "./tileGeometry";

/** Board-space spots of the bank's things in the middle of the felt. */
export const BANK_PLATE: Vec2 = { x: 0, y: -5.6 };
export const BANK_MONEY: Vec2 = { x: 2.6, y: -5.6 };
export const BANK_DEEDS: Vec2 = { x: -2.6, y: -5.6 };

/** Seat-local spots of a player's things. */
const SEAT_MONEY = { right: 2.7, up: -1.05 };
const SEAT_DEEDS = { right: 0, up: -3.3 };

export interface Anchors {
  readonly layout: HexLayout;
  readonly slabMargin: number;
  /** playerId → side. */
  readonly sides: ReadonlyMap<string, number>;
  readonly tableY: number;
}

function frameFor(anchors: Anchors, playerId: string): SeatFrame {
  return seatFrame(anchors.layout, anchors.slabMargin, anchors.sides.get(playerId) ?? 0);
}

/** Where a party keeps its money, in world space. */
export function moneyAnchor(anchors: Anchors, party: Party): Vector3 {
  if (party.type === "bank") return new Vector3(...boardToWorld(BANK_MONEY, 0.05));
  const frame = frameFor(anchors, party.playerId);
  return new Vector3(...boardToWorld(seatPoint(frame, SEAT_MONEY.right, SEAT_MONEY.up), anchors.tableY + 0.05));
}

/** Where a party keeps its deeds, in world space. */
export function deedAnchor(anchors: Anchors, party: Party): Vector3 {
  if (party.type === "bank") return new Vector3(...boardToWorld(BANK_DEEDS, 0.05));
  const frame = frameFor(anchors, party.playerId);
  return new Vector3(...boardToWorld(seatPoint(frame, SEAT_DEEDS.right, SEAT_DEEDS.up), anchors.tableY + 0.05));
}

/** Yaw a flat card should have when lying at a party's spot. */
export function partyYaw(anchors: Anchors, party: Party): number {
  if (party.type === "bank") return 0;
  const frame = frameFor(anchors, party.playerId);
  return Math.atan2(frame.right.y, frame.right.x);
}
