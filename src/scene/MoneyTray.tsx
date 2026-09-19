import { useMemo } from "react";
import { BILL_DENOMINATIONS, billBreakdown } from "../game";
import { billTexture, countChipTexture } from "./billTextures";
import type { SeatFrame } from "./seats";
import { seatPoint, seatYaw } from "./seats";
import { boardToWorld } from "./tileGeometry";

export interface MoneyTrayProps {
  readonly frame: SeatFrame;
  readonly cash: number;
  /** Seat-local `right` coordinate where the tray starts. */
  readonly startRight: number;
  readonly up: number;
  readonly y: number;
}

const BILL_W = 0.68;
const BILL_H = 0.34;
const COLUMN = 0.76;
const MAX_VISIBLE = 8;
const BILL_THICKNESS = 0.012;

/** Deterministic little wobble so stacks look hand-placed rather than printed. */
function wobble(i: number, j: number): number {
  return (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
}

/**
 * The player's cash as stacks of bills, one column per denomination, with a
 * count on top of each stack. Cosmetic: the number on the plate is the truth.
 */
export function MoneyTray({ frame, cash, startRight, up, y }: MoneyTrayProps) {
  const bills = useMemo(() => billBreakdown(cash), [cash]);
  const yaw = seatYaw(frame);
  const rotation: [number, number, number] = [-Math.PI / 2, 0, yaw];
  return (
    <group>
      {BILL_DENOMINATIONS.map((value, column) => {
        const count = bills[value];
        if (count === 0) return null;
        const right = startRight + column * COLUMN;
        const visible = Math.min(count, MAX_VISIBLE);
        const stack = [];
        for (let i = 0; i < visible; i++) {
          const dx = (wobble(column, i) - 0.5) * 0.06;
          const dy = (wobble(column + 7, i) - 0.5) * 0.06;
          const twist = (wobble(column + 3, i) - 0.5) * 0.18;
          stack.push(
            <mesh
              key={i}
              rotation={[-Math.PI / 2, 0, yaw + twist]}
              position={boardToWorld(seatPoint(frame, right + dx, up + dy), y + BILL_THICKNESS * (i + 1))}
              castShadow={i === visible - 1}
            >
              <planeGeometry args={[BILL_W, BILL_H]} />
              <meshStandardMaterial map={billTexture(value)} roughness={0.9} />
            </mesh>,
          );
        }
        return (
          <group key={value}>
            {stack}
            <mesh rotation={rotation} position={boardToWorld(seatPoint(frame, right + BILL_W * 0.32, up - BILL_H * 0.28), y + BILL_THICKNESS * (visible + 1) + 0.002)}>
              <planeGeometry args={[0.2, 0.2]} />
              <meshStandardMaterial map={countChipTexture(count)} transparent roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
