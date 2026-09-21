import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { DeedId, Holding } from "../game";
import { DEEDS, SQUARES, getDeed } from "../game";
import type { PlateInfo } from "./cardTextures";
import { deedCardTexture, namePlateTexture } from "./cardTextures";
import { MoneyTray } from "./MoneyTray";
import type { SeatFrame } from "./seats";
import { seatPoint, seatYaw } from "./seats";
import { boardToWorld } from "./tileGeometry";

export interface PlayerAreaProps {
  readonly playerId: string;
  readonly frame: SeatFrame;
  readonly plate: PlateInfo;
  readonly holdings: Readonly<Partial<Record<DeedId, Holding>>>;
  readonly y: number;
  readonly onHover: (index: number | null) => void;
  readonly onSelect: (index: number) => void;
  readonly onFocus: (index: number) => void;
}

const PLATE_W = 4.4;
const PLATE_H = 1.375;
/** The plate sits left of centre; the money tray fills the space to its right. */
const PLATE_RIGHT = -2.9;
const TRAY_START = 0.0;
const CARD_W = 1.15;
const CARD_H = 1.63;
const CARD_GAP = 0.12;
const CARDS_PER_ROW = 8;
/** Well clear of the bill stacks (which stand up to 0.7 above the felt), even from a low camera. */
const FIRST_ROW_UP = -3.4;
/** Rows overlap like a hand of cards; the band and name of every card stay visible. */
const ROW_STEP = CARD_H * 0.62;

const SQUARE_OF_DEED = new Map<DeedId, number>();
for (const square of SQUARES) {
  if (square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania") SQUARE_OF_DEED.set(square.deedId, square.index);
}

/**
 * Everything a player keeps on their side of the table: a name plate with
 * their cash and status, and their deed cards laid out in rows. Cards are
 * clickable and select the matching square, so building and mortgaging can
 * be done from here.
 */
export function PlayerArea({ playerId, frame, plate, holdings, y, onHover, onSelect, onFocus }: PlayerAreaProps) {
  const yaw = seatYaw(frame);
  const rotation: [number, number, number] = [-Math.PI / 2, 0, yaw];
  const plateTexture = useMemo(() => namePlateTexture(plate), [plate]);
  useEffect(() => () => plateTexture.dispose(), [plateTexture]);

  const owned = useMemo(() => DEEDS.filter((deed) => holdings[deed.id]?.ownerId === playerId), [holdings, playerId]);

  return (
    <group>
      <mesh rotation={rotation} position={boardToWorld(seatPoint(frame, PLATE_RIGHT, -1.05), y)}>
        <planeGeometry args={[PLATE_W, PLATE_H]} />
        <meshStandardMaterial map={plateTexture} roughness={1} />
      </mesh>
      {!plate.bankrupt && <MoneyTray frame={frame} cash={plate.cash} startRight={TRAY_START} up={-1.05} y={y} />}
      {owned.map((deed, i) => {
        const holding = holdings[deed.id];
        if (!holding) return null;
        const row = Math.floor(i / CARDS_PER_ROW);
        const col = i % CARDS_PER_ROW;
        const inRow = Math.min(owned.length - row * CARDS_PER_ROW, CARDS_PER_ROW);
        const right = (col - (inRow - 1) / 2) * (CARD_W + CARD_GAP);
        const up = FIRST_ROW_UP - row * ROW_STEP;
        const square = SQUARE_OF_DEED.get(deed.id);
        return (
          <DeedCard
            key={deed.id}
            deedId={deed.id}
            holding={holding}
            position={boardToWorld(seatPoint(frame, right, up), y + 0.004 * (row + 1) + 0.0002 * col)}
            rotation={rotation}
            onHover={() => onHover(square ?? null)}
            onLeave={() => onHover(null)}
            onSelect={() => square !== undefined && onSelect(square)}
            onFocus={() => square !== undefined && onFocus(square)}
          />
        );
      })}
    </group>
  );
}

interface DeedCardProps {
  readonly deedId: DeedId;
  readonly holding: Holding;
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly onHover: () => void;
  readonly onLeave: () => void;
  readonly onSelect: () => void;
  readonly onFocus: () => void;
}

function DeedCard({ deedId, holding, position, rotation, onHover, onLeave, onSelect, onFocus }: DeedCardProps) {
  const texture = useMemo(() => deedCardTexture(getDeed(deedId), holding), [deedId, holding]);
  return (
    <mesh
      name="deed-card"
      rotation={rotation}
      position={position}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        onHover();
      }}
      onPointerOut={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        onLeave();
      }}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onFocus();
      }}
    >
      <planeGeometry args={[CARD_W, CARD_H]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}
