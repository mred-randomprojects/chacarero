import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { DeedId, Holding } from "../game";
import { SQUARES, getDeed } from "../game";
import { CARD_H, CARD_W, deedSlot, seatDeeds, seatSlots } from "./deedSlots";
import type { ActiveEffect } from "./effectsBus";
import { effectsBus } from "./effectsBus";
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
/** How fast cards slide to a new place when the row makes room or closes up (per second, exponential). */
const SLIDE_RATE = 9;
const NEW_HOLDING: Holding = { ownerId: "", chacras: 0, estancia: false, mortgaged: false };
/** A flight the table never follows up (a reset) stops holding its slot after this long. */
const SETTLE_TIMEOUT_MS = 1500;

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

  // Deeds flying to or from this seat. A slot stays reserved (or a card hidden) after the flight
  // lands until the replayed holdings show the move, so nothing flickers in between.
  const [active, setActive] = useState<readonly ActiveEffect[]>([]);
  useEffect(() => effectsBus.subscribe(setActive), []);
  const traffic = useRef(new Map<DeedId, { dir: "in" | "out"; landedAt: number | null }>());
  const flying = new Map<DeedId, "in" | "out">();
  for (const { effect } of active) {
    if (effect.kind !== "deed") continue;
    if (effect.to.type === "player" && effect.to.playerId === playerId) flying.set(effect.deedId, "in");
    else if (effect.from.type === "player" && effect.from.playerId === playerId) flying.set(effect.deedId, "out");
  }
  const now = performance.now();
  for (const [deedId, dir] of flying) traffic.current.set(deedId, { dir, landedAt: null });
  for (const [deedId, entry] of traffic.current) {
    if (flying.has(deedId)) continue;
    entry.landedAt ??= now;
    const mine = holdings[deedId]?.ownerId === playerId;
    if ((entry.dir === "in") === mine || now - entry.landedAt > SETTLE_TIMEOUT_MS) traffic.current.delete(deedId);
  }
  const incoming = new Set<DeedId>();
  const outgoing = new Set<DeedId>();
  for (const [deedId, entry] of traffic.current) (entry.dir === "in" ? incoming : outgoing).add(deedId);
  const laidOut = seatDeeds(holdings, playerId, incoming, outgoing);
  const places = laidOut.map((deedId, i) => {
    const slot = deedSlot(i, laidOut.length);
    return [deedId, boardToWorld(seatPoint(frame, slot.right, slot.up), y + slot.lift)] as const;
  });
  const placesKey = places.map(([id, p]) => `${id}:${p.join(",")}`).join("|");
  useLayoutEffect(() => {
    const published = seatSlots.get(playerId) ?? new Map<DeedId, readonly [number, number, number]>();
    for (const [deedId, position] of places) published.set(deedId, position);
    seatSlots.set(playerId, published);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placesKey is the content of places
  }, [playerId, placesKey]);

  return (
    <group>
      <mesh rotation={rotation} position={boardToWorld(seatPoint(frame, PLATE_RIGHT, -1.05), y)}>
        <planeGeometry args={[PLATE_W, PLATE_H]} />
        <meshStandardMaterial map={plateTexture} roughness={1} />
      </mesh>
      {!plate.bankrupt && <MoneyTray frame={frame} cash={plate.cash} startRight={TRAY_START} up={-1.05} y={y} />}
      {places.map(([deedId, position]) => {
        // A reserved slot stays empty while the card flies there, and holds it the frame it lands,
        // before the replayed holdings (a render later) say it is ours.
        if (flying.get(deedId) === "in") return null;
        const shown = holdings[deedId];
        const holding = shown?.ownerId === playerId ? shown : incoming.has(deedId) ? { ...NEW_HOLDING, ownerId: playerId } : null;
        if (!holding) return null;
        const square = SQUARE_OF_DEED.get(deedId);
        return (
          <DeedCard
            key={deedId}
            deedId={deedId}
            holding={holding}
            position={position}
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
  /** Where the card lies; when it changes the card slides there. */
  readonly position: readonly [number, number, number];
  readonly rotation: [number, number, number];
  readonly onHover: () => void;
  readonly onLeave: () => void;
  readonly onSelect: () => void;
  readonly onFocus: () => void;
}

function DeedCard({ deedId, holding, position, rotation, onHover, onLeave, onSelect, onFocus }: DeedCardProps) {
  const texture = useMemo(() => deedCardTexture(getDeed(deedId), holding), [deedId, holding]);
  const mesh = useRef<Mesh>(null);
  // Placed once where it first lies; afterwards the frame loop slides it.
  const initial = useRef(position);
  const [x, y, z] = position;
  useFrame((_, delta) => {
    mesh.current?.position.lerp({ x, y, z }, Math.min(1, delta * SLIDE_RATE));
  });
  return (
    <mesh
      ref={mesh}
      name="deed-card"
      rotation={rotation}
      position={initial.current}
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
