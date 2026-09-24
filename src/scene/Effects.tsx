import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { DoubleSide, Quaternion, Vector3 } from "three";
import type { Card } from "../game";
import { getDeed } from "../game";
import type { Anchors } from "./anchors";
import { deedAnchor, moneyAnchor, partyYaw } from "./anchors";
import { CARD_H, CARD_W, seatSlots } from "./deedSlots";
import { billTexture } from "./billTextures";
import { buildingSpot } from "./buildingSpots";
import { chanceBackTexture, chanceCardTexture, deedCardTexture } from "./cardTextures";
import type { ActiveEffect } from "./effectsBus";
import { effectsBus } from "./effectsBus";
import { sfx } from "../audio/sfx";
import { pawnTracker } from "./pawnTracker";
import { pace } from "../ui/pace";

export interface EffectsProps {
  readonly anchors: Anchors;
  /** Suerte/Destino card face up on the table, from the table's view. */
  readonly cardOnTable: Card | null;
}

/**
 * Something shown on the table that plays an exit animation before it goes:
 * the prop that drives it may already be null while `hiding` runs.
 */
interface Shown<T> {
  readonly item: T;
  readonly hiding: boolean;
}

/** Keeps `item` mounted after the prop drops it, flagged `hiding`, until the component reports it is gone. */
function useShown<T>(item: T | null, same: (a: T, b: T) => boolean): [Shown<T> | null, () => void] {
  const [shown, setShown] = useState<Shown<T> | null>(item ? { item, hiding: false } : null);
  useEffect(() => {
    setShown((current) => {
      if (item) return current && same(current.item, item) && !current.hiding ? current : { item, hiding: false };
      return current && !current.hiding ? { ...current, hiding: true } : current;
    });
  }, [item, same]);
  const gone = useCallback(() => setShown((current) => (current?.hiding ? null : current)), []);
  return [shown, gone];
}

const sameCard = (a: Card, b: Card) => a.id === b.id;

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Point on a parabolic arc between two spots. */
function arc(from: Vector3, to: Vector3, k: number, height: number): Vector3 {
  return new Vector3(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + height * 4 * k * (1 - k), from.z + (to.z - from.z) * k);
}

/**
 * Renders every animation the UI requested through the effects bus: bills and
 * deed cards flying between the bank and the seats, buildings dropping onto
 * tiles, and the face-up Suerte/Destino card hovering over the board.
 */
export function Effects({ anchors, cardOnTable }: EffectsProps) {
  const [active, setActive] = useState<readonly ActiveEffect[]>([]);
  useEffect(() => effectsBus.subscribe(setActive), []);

  const [shownCard, cardGone] = useShown(cardOnTable, sameCard);
  // A reveal requested for a card that is not on the table has nothing to animate. (Checked against the
  // prop, not the mounted card, which lags a render: the card is put on the table right before the request.)
  useEffect(() => {
    for (const entry of active) {
      if (entry.effect.kind === "revealCard" && (!cardOnTable || cardOnTable.id !== entry.effect.cardId)) entry.resolve();
    }
  }, [active, cardOnTable]);

  return (
    <group>
      {active.map((entry) => {
        switch (entry.effect.kind) {
          case "money":
            return <MoneyFlight key={entry.id} anchors={anchors} from={entry.effect.from} to={entry.effect.to} amount={entry.effect.amount} onDone={entry.resolve} />;
          case "deed":
            return <DeedFlight key={entry.id} anchors={anchors} deedId={entry.effect.deedId} from={entry.effect.from} to={entry.effect.to} onDone={entry.resolve} />;
          case "building":
            return (
              <BuildingDrop key={entry.id} anchors={anchors} deedId={entry.effect.deedId} chacras={entry.effect.chacras} estancia={entry.effect.estancia} removed={entry.effect.removed} onDone={entry.resolve} />
            );
          default:
            return null;
        }
      })}
      {shownCard && (
        <ChanceCard
          key={shownCard.item.id}
          card={shownCard.item}
          revealing={active.find((e) => e.effect.kind === "revealCard" && e.effect.cardId === shownCard.item.id) ?? null}
          hiding={shownCard.hiding}
          onHidden={cardGone}
        />
      )}

    </group>
  );
}

// ---------- money ----------

interface MoneyFlightProps {
  readonly anchors: Anchors;
  readonly from: Parameters<typeof moneyAnchor>[1];
  readonly to: Parameters<typeof moneyAnchor>[1];
  readonly amount: number;
  readonly onDone: () => void;
}

const BILL_FLIGHT = 0.8;
const BILL_STAGGER = 0.09;

function MoneyFlight({ anchors, from, to, amount, onDone }: MoneyFlightProps) {
  const count = Math.min(9, Math.max(2, Math.round(amount / 1_000) + 1));
  const start = useMemo(() => moneyAnchor(anchors, from), [anchors, from]);
  const end = useMemo(() => moneyAnchor(anchors, to), [anchors, to]);
  const yawFrom = useMemo(() => partyYaw(anchors, from), [anchors, from]);
  const yawTo = useMemo(() => partyYaw(anchors, to), [anchors, to]);
  const bills = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        offset: new Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 0.5),
        landing: new Vector3((Math.random() - 0.5) * 1.4, 0.012 * i, (Math.random() - 0.5) * 0.6),
        value: [5000, 2000, 1000, 500, 200, 100][i % 6] as 5000 | 2000 | 1000 | 500 | 200 | 100,
        twist: (Math.random() - 0.5) * 0.6,
      })),
    [count],
  );
  const refs = useRef<(Mesh | null)[]>([]);
  const t = useRef(0);
  const done = useRef(false);
  const total = BILL_FLIGHT + BILL_STAGGER * (count - 1);

  useEffect(() => {
    sfx.play("cash", { volume: 0.7 });
  }, []);

  useFrame((_, delta) => {
    t.current += delta * pace.rate;
    bills.forEach((bill, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const k = Math.min(1, Math.max(0, (t.current - i * BILL_STAGGER) / BILL_FLIGHT));
      const a = new Vector3().addVectors(start, bill.offset);
      const b = new Vector3().addVectors(end, bill.landing);
      const p = arc(a, b, easeInOut(k), 2.2);
      mesh.position.copy(p);
      mesh.rotation.set(-Math.PI / 2 + Math.sin(k * Math.PI) * 0.6, 0, yawFrom + (yawTo - yawFrom) * k + bill.twist * Math.sin(k * Math.PI));
      mesh.visible = k > 0 && k < 1;
      // The camera follows the middle of the flock.
      if (i === Math.floor(count / 2)) {
        pawnTracker.kind = "flight";
        pawnTracker.position.copy(p);
        pawnTracker.moving = t.current < total;
      }
    });
    if (t.current >= total && !done.current) {
      done.current = true;
      pawnTracker.moving = false;
      sfx.play("cashBig", { volume: 0.5 });
      onDone();
    }
  });

  return (
    <group>
      {bills.map((bill, i) => (
        <mesh
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          visible={false}
          castShadow
        >
          <planeGeometry args={[0.68, 0.34]} />
          <meshStandardMaterial map={billTexture(bill.value)} roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- deed cards ----------

interface DeedFlightProps {
  readonly anchors: Anchors;
  readonly deedId: Parameters<typeof getDeed>[0];
  readonly from: Parameters<typeof deedAnchor>[1];
  readonly to: Parameters<typeof deedAnchor>[1];
  readonly onDone: () => void;
}

const DEED_FLIGHT = 1.0;

/** Where a deed lies (or will lie) for a party: its own slot at a seat, the pile for the bank. */
function deedSpot(anchors: Anchors, party: DeedFlightProps["from"], deedId: DeedFlightProps["deedId"]): Vector3 {
  const slot = party.type === "player" ? seatSlots.get(party.playerId)?.get(deedId) : undefined;
  return slot ? new Vector3(...slot) : deedAnchor(anchors, party);
}

function DeedFlight({ anchors, deedId, from, to, onDone }: DeedFlightProps) {
  // Leaves from where the card lay; lands in the slot the seat keeps free for it (read each frame: the row makes room as it flies).
  const start = useMemo(() => deedSpot(anchors, from, deedId), [anchors, from, deedId]);
  const end = useRef(deedAnchor(anchors, to));
  const yawFrom = useMemo(() => partyYaw(anchors, from), [anchors, from]);
  const yawTo = useMemo(() => partyYaw(anchors, to), [anchors, to]);
  const texture = useMemo(() => deedCardTexture(getDeed(deedId), { ownerId: "", chacras: 0, estancia: false, mortgaged: false }), [deedId]);
  const mesh = useRef<Mesh>(null);
  const t = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    sfx.play("cardDraw", { volume: 0.8 });
  }, []);

  useFrame((_, delta) => {
    t.current += delta * pace.rate;
    const k = Math.min(1, t.current / DEED_FLIGHT);
    const node = mesh.current;
    if (!node) return;
    end.current = deedSpot(anchors, to, deedId);
    node.position.copy(arc(start, end.current, easeInOut(k), 2.8));
    node.rotation.set(-Math.PI / 2 + Math.sin(k * Math.PI) * 0.9, 0, yawFrom + (yawTo - yawFrom) * k);
    // The camera follows the card across the table.
    pawnTracker.kind = "flight";
    pawnTracker.position.copy(node.position);
    pawnTracker.moving = k < 1;
    if (k >= 1 && !done.current) {
      done.current = true;
      pawnTracker.moving = false;
      sfx.play("deedBuy", { volume: 0.9 });
      onDone();
    }
  });

  return (
    <mesh ref={mesh} castShadow name="deed-flight">
      <planeGeometry args={[CARD_W, CARD_H]} />
      <meshStandardMaterial map={texture} roughness={1} side={DoubleSide} />
    </mesh>
  );
}

// ---------- buildings ----------

interface BuildingDropProps {
  readonly anchors: Anchors;
  readonly deedId: Parameters<typeof getDeed>[0];
  readonly chacras: number;
  readonly estancia: boolean;
  readonly removed: boolean;
  readonly onDone: () => void;
}

const DROP_SECONDS = 0.55;

function BuildingDrop({ anchors, deedId, chacras, estancia, removed, onDone }: BuildingDropProps) {
  const spot = useMemo(() => buildingSpot(anchors.layout, deedId, estancia ? 0 : Math.max(0, chacras - (removed ? 0 : 1)), estancia ? 1 : Math.max(1, chacras + (removed ? 1 : 0))), [anchors.layout, deedId, chacras, estancia, removed]);
  const mesh = useRef<Mesh>(null);
  const t = useRef(0);
  const done = useRef(false);
  const size: [number, number, number] = estancia ? [0.5, 0.32, 0.34] : [0.22, 0.2, 0.22];
  const restY = 0.02 + size[1] / 2;

  useFrame((_, delta) => {
    t.current += delta * pace.rate;
    const k = Math.min(1, t.current / DROP_SECONDS);
    const node = mesh.current;
    if (!node) return;
    if (removed) {
      node.position.set(spot.position.x, restY + easeOutCubic(k) * 3, spot.position.z);
      node.scale.setScalar(1 - k);
    } else {
      const fall = k * k;
      const bounce = k > 0.85 ? Math.sin(((k - 0.85) / 0.15) * Math.PI) * 0.12 : 0;
      node.position.set(spot.position.x, restY + (1 - fall) * 3 + bounce, spot.position.z);
    }
    node.rotation.set(0, spot.yaw, 0);
    if (k >= 1 && !done.current) {
      done.current = true;
      sfx.play(removed ? "sellBuilding" : "build", { volume: 0.9 });
      onDone();
    }
  });

  return (
    <mesh ref={mesh} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={estancia ? "#f2c21c" : "#5cc8f2"} roughness={0.5} />
    </mesh>
  );
}

// ---------- Suerte / Destino ----------

interface ChanceCardProps {
  readonly card: Card;
  /** The replay step waiting for the card to come up, if any. */
  readonly revealing: ActiveEffect | null;
  readonly hiding: boolean;
  readonly onHidden: () => void;
}

/** The draw: slide out from under the deck, then rise and turn to face the viewer. */
const SLIDE_SECONDS = 0.4;
const REVEAL_SECONDS = 1.1;
const SLIDE_DISTANCE = 2.4;
/** How far in front of the camera the face-up card floats. */
const HOVER_DISTANCE = 9;

function ChanceCard({ card, revealing, hiding, onHidden }: ChanceCardProps) {
  const camera = useThree((s) => s.camera);
  const group = useRef<Group>(null);
  const face = useMemo(() => chanceCardTexture(card), [card]);
  const back = useMemo(() => chanceBackTexture(card.deck), [card.deck]);
  const slot = useMemo(() => (card.deck === "suerte" ? new Vector3(-4.6, 0.05, -4.2) : new Vector3(4.6, 0.05, 4.2)), [card.deck]);
  /** Where the card is once slid out from under the deck (towards the middle of the felt). */
  const drawn = useMemo(() => slot.clone().add(new Vector3(0, 0.02, card.deck === "suerte" ? SLIDE_DISTANCE : -SLIDE_DISTANCE)), [slot, card.deck]);
  const t = useRef(0);
  const resolvedReveal = useRef(false);
  const startedHide = useRef(false);
  const hover = useRef(new Vector3(0, 3.6, 0));

  useEffect(() => {
    sfx.play("cardDraw");
  }, []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    if (hiding && !startedHide.current) {
      startedHide.current = true;
      t.current = 0;
    }
    t.current += delta * pace.rate;
    // Face down in the slot (the back on top), facing the camera while up in the air.
    const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    const facing = camera.quaternion.clone();
    if (!hiding && t.current < SLIDE_SECONDS) {
      const slide = easeInOut(t.current / SLIDE_SECONDS);
      node.position.lerpVectors(slot, drawn, slide);
      node.quaternion.copy(flat);
      return;
    }
    const k = Math.min(1, (hiding ? t.current : t.current - SLIDE_SECONDS) / REVEAL_SECONDS);
    const e = easeInOut(k);
    if (!hiding) {
      // Float in front of wherever the camera is now, but never below the table.
      const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      hover.current.copy(camera.position).addScaledVector(forward, HOVER_DISTANCE);
      hover.current.y = Math.max(2.4, hover.current.y);
    }
    if (hiding) {
      node.position.copy(arc(hover.current, slot, e, 1.2));
      node.quaternion.copy(facing).slerp(flat, e);
      if (k >= 1) onHidden();
      return;
    }
    node.position.copy(arc(drawn, hover.current, e, 1.5));
    node.quaternion.copy(flat).slerp(facing, e);
    if (k >= 1 && !resolvedReveal.current) {
      resolvedReveal.current = true;
      revealing?.resolve();
    }
  });

  return (
    <group ref={group} name="chance-card">
      {/* Unlit so the text reads the same from every seat and camera angle. */}
      <mesh castShadow>
        <planeGeometry args={[4.8, 3]} />
        <meshBasicMaterial map={face} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4.8, 3]} />
        <meshBasicMaterial map={back} />
      </mesh>
    </group>
  );
}
