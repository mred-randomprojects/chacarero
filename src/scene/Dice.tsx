import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh } from "three";
import { Quaternion, Vector3 } from "three";
import { sfx } from "../audio/sfx";
import { FACE_VALUES, diceFaceTexture, faceNormal } from "./diceFaces";
import { diceHurry, pawnKnocks } from "./pawnKnocks";
import type { SeatFrame } from "./seats";
import { seatPoint } from "./seats";
import { boardToWorld } from "./tileGeometry";

export interface DiceThrow {
  readonly id: number;
  readonly values: readonly [number, number];
  /** Seeds the tumble and landing spots so every screen sees the same throw. */
  readonly seed: number;
}

/** A pawn standing on the board, as an obstacle for the dice. */
export interface PawnObstacle {
  readonly id: string;
  readonly position: Vector3;
}

/** Small deterministic generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DiceProps {
  /** Seat of the player holding the dice. */
  readonly frame: SeatFrame;
  /** World point the throw aims at: beside the current player's pawn. */
  readonly target: Vector3;
  /** Every pawn on the board; a die landing on one knocks it. */
  readonly obstacles: readonly PawnObstacle[];
  /** True while the player is shaking the dice in their hands. */
  readonly shaking: boolean;
  /** A new id starts a throw that ends showing `values`. */
  readonly throwing: DiceThrow | null;
  readonly tableY: number;
  readonly onSettled: (id: number) => void;
}

const SIZE = 0.72;
const HALF = SIZE / 2;
const FLIGHT_SECONDS = 1.15;
const HAND_HEIGHT = 2.4;
const ARC_HEIGHT = 2.6;
const UP = new Vector3(0, 1, 0);
/** How far a die scatters around the target. */
const SCATTER = 1.5;
/** A die closer than this to a pawn's foot bumps it. */
const PAWN_RADIUS = 0.62;
/** The close-up: rise, hold, drop back. */
const PRESENT_RISE = 0.45;
const PRESENT_HOLD = 0.85;
const PRESENT_RETURN = 0.4;
const PRESENT_DISTANCE = 4.8;

type Mode = "rest" | "shake" | "fly" | "present";

interface DieState {
  mode: Mode;
  /** Seconds since the throw (or the presentation) started. */
  t: number;
  /** Bounces already voiced during this flight. */
  bounces: number;
  start: Vector3;
  end: Vector3;
  spinAxis: Vector3;
  spinSpeed: number;
  spinQuat: Quaternion;
  finalQuat: Quaternion;
  /** Pawn this die bumps when it lands, if any. */
  knocks: { id: string; dir: Vector3 } | null;
  knocked: boolean;
  landed: boolean;
  /** Where the die was when the presentation began (it goes back there). */
  presentFrom: Vector3;
  presentQuat: Quaternion;
}

function randomUnit(random: () => number = Math.random): Vector3 {
  return new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
}

/** Orientation that shows `value` on top, with a random spin about the vertical. */
function restingQuaternion(value: number, random: () => number = Math.random): Quaternion {
  const q = new Quaternion().setFromUnitVectors(faceNormal(value), UP);
  const yaw = new Quaternion().setFromAxisAngle(UP, random() * Math.PI * 2);
  return yaw.multiply(q);
}

/** Landing spot around `target`, with the two dice kept apart. */
function landingSpot(target: Vector3, index: number, random: () => number): Vector3 {
  const angle = random() * Math.PI * 2;
  const radius = 0.4 + random() * SCATTER;
  const x = target.x + Math.cos(angle) * radius + (index === 0 ? -0.5 : 0.5);
  const z = target.z + Math.sin(angle) * radius;
  return new Vector3(x, 0, z);
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Height above the table during flight: one big arc, then two small bounces. */
function flightHeight(u: number): number {
  if (u < 0.6) {
    const a = u / 0.6;
    return HAND_HEIGHT * (1 - a) + ARC_HEIGHT * 4 * a * (1 - a);
  }
  if (u < 0.8) return Math.sin(((u - 0.6) / 0.2) * Math.PI) * 0.45;
  if (u < 0.95) return Math.sin(((u - 0.8) / 0.15) * Math.PI) * 0.14;
  return 0;
}

/**
 * Two physical-looking dice. They rest on the felt showing the last roll,
 * rattle above the current player's seat while `shaking`, fly to the spot
 * beside that player's pawn on a throw (bumping any pawn they land on),
 * and once settled rise into the camera so everyone reads the result
 * before the turn goes on.
 */
export function Dice({ frame, target, obstacles, shaking, throwing, tableY, onSettled }: DiceProps) {
  const meshes = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const camera = useThree((s) => s.camera);
  const faces = useMemo(() => FACE_VALUES.map((value) => diceFaceTexture(value)), []);
  useEffect(() => () => faces.forEach((f) => f.dispose()), [faces]);
  const restY = tableY + HALF;

  const dice = useRef<DieState[]>(
    [0, 1].map((i) => ({
      mode: "rest",
      t: 0,
      bounces: 0,
      start: new Vector3(),
      end: new Vector3(i === 0 ? -0.9 : 0.9, restY, 3),
      spinAxis: randomUnit(),
      spinSpeed: 0,
      spinQuat: restingQuaternion(1 + i),
      finalQuat: restingQuaternion(1 + i),
      knocks: null,
      knocked: false,
      landed: true,
      presentFrom: new Vector3(),
      presentQuat: new Quaternion(),
    })),
  );
  const activeThrow = useRef<number | null>(null);
  const hurrySeen = useRef(diceHurry.requested);
  const latest = useRef({ target, obstacles });
  latest.current = { target, obstacles };

  useEffect(() => {
    if (!throwing || throwing.id === activeThrow.current) return;
    activeThrow.current = throwing.id;
    hurrySeen.current = diceHurry.requested;
    const random = seeded(throwing.seed * 7919 + 17);
    const { target: aim, obstacles: pawns } = latest.current;
    dice.current.forEach((die, i) => {
      const mesh = meshes[i]?.current;
      const value = throwing.values[i] ?? 1;
      die.mode = "fly";
      die.t = 0;
      die.bounces = 0;
      die.start = mesh ? mesh.position.clone() : handPosition(frame, i, tableY);
      die.end = landingSpot(aim, i, random).setY(restY);
      die.knocks = null;
      die.knocked = false;
      // Landing on a pawn: the pawn gets a shove and the die rolls off it.
      const hit = pawns.find((p) => Math.hypot(p.position.x - die.end.x, p.position.z - die.end.z) < PAWN_RADIUS);
      if (hit) {
        const away = new Vector3(die.end.x - hit.position.x, 0, die.end.z - hit.position.z);
        if (away.lengthSq() < 1e-4) away.set(Math.cos(random() * Math.PI * 2), 0, Math.sin(random() * Math.PI * 2));
        away.normalize();
        die.knocks = { id: hit.id, dir: away.clone().negate() };
        die.end.addScaledVector(away, PAWN_RADIUS + 0.25);
      }
      die.spinAxis = randomUnit(random);
      die.spinSpeed = 14 + random() * 8;
      die.spinQuat = mesh ? mesh.quaternion.clone() : new Quaternion();
      die.finalQuat = restingQuaternion(value, random);
      die.landed = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meshes are stable refs
  }, [throwing, frame, tableY, restY]);

  useEffect(() => {
    for (const die of dice.current) {
      if (die.mode === "fly" || die.mode === "present") continue;
      die.mode = shaking ? "shake" : "rest";
    }
    if (!shaking) return;
    // Rattle while the hands are moving.
    sfx.play("diceGrab", { volume: 0.7 });
    const id = setInterval(() => sfx.play("diceShake", { volume: 0.6, rate: 0.95 + Math.random() * 0.1 }), 320);
    return () => clearInterval(id);
  }, [shaking]);

  /** Where die `i` floats during the close-up, and how it faces the viewer. */
  const presentPose = (i: number, value: number): { position: Vector3; quaternion: Quaternion } => {
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const position = camera.position
      .clone()
      .addScaledVector(forward, PRESENT_DISTANCE)
      .addScaledVector(right, i === 0 ? -0.7 : 0.7)
      .addScaledVector(up, 0.25);
    position.y = Math.max(restY + 0.6, position.y);
    const toCamera = camera.position.clone().sub(position).normalize();
    const quaternion = new Quaternion().setFromUnitVectors(faceNormal(value), toCamera);
    // A touch of roll so the two dice do not look stamped.
    quaternion.premultiply(new Quaternion().setFromAxisAngle(toCamera, i === 0 ? -0.18 : 0.14));
    return { position, quaternion };
  };

  useFrame((_, delta) => {
    let allLanded = true;
    let allPresented = true;
    dice.current.forEach((die, i) => {
      const mesh = meshes[i]?.current;
      if (!mesh) return;
      switch (die.mode) {
        case "rest":
          mesh.position.lerp(die.end, Math.min(1, delta * 10));
          mesh.quaternion.slerp(die.finalQuat, Math.min(1, delta * 10));
          break;
        case "shake": {
          const hand = handPosition(frame, i, tableY);
          hand.x += (Math.random() - 0.5) * 0.5;
          hand.y += (Math.random() - 0.5) * 0.4;
          hand.z += (Math.random() - 0.5) * 0.5;
          mesh.position.lerp(hand, Math.min(1, delta * 18));
          const dq = new Quaternion().setFromAxisAngle(randomUnit(), delta * 9);
          mesh.quaternion.premultiply(dq);
          break;
        }
        case "fly": {
          die.t += delta;
          const u = Math.min(1, die.t / FLIGHT_SECONDS);
          // Knocks on the felt: the first landing, then two smaller bounces.
          const knocks = [0.6, 0.8, 0.95];
          while (die.bounces < knocks.length && u >= (knocks[die.bounces] ?? 2)) {
            sfx.play("dieLand", { volume: [0.9, 0.5, 0.3][die.bounces] ?? 0.3, rate: 0.9 + Math.random() * 0.25 });
            die.bounces += 1;
          }
          if (die.knocks && !die.knocked && u >= 0.6) {
            die.knocked = true;
            pawnKnocks.set(die.knocks.id, { t: 0, dir: die.knocks.dir });
            sfx.play("build", { volume: 0.5, rate: 1.3 });
          }
          const ground = easeOutCubic(Math.min(1, u / 0.7));
          mesh.position.x = die.start.x + (die.end.x - die.start.x) * ground;
          mesh.position.z = die.start.z + (die.end.z - die.start.z) * ground;
          mesh.position.y = restY + flightHeight(u);
          if (u < 0.6) {
            const dq = new Quaternion().setFromAxisAngle(die.spinAxis, delta * die.spinSpeed * (1 - u * 0.5));
            die.spinQuat.premultiply(dq);
            mesh.quaternion.copy(die.spinQuat);
          } else {
            const k = easeOutCubic((u - 0.6) / 0.4);
            mesh.quaternion.copy(die.spinQuat).slerp(die.finalQuat, k);
          }
          if (u >= 1 && !die.landed) {
            die.landed = true;
            mesh.quaternion.copy(die.finalQuat);
          }
          break;
        }
        case "present": {
          die.t += delta;
          const value = throwing?.values[i] ?? 1;
          const pose = presentPose(i, value);
          const total = PRESENT_RISE + PRESENT_HOLD + PRESENT_RETURN;
          if (die.t < PRESENT_RISE) {
            const k = easeInOut(die.t / PRESENT_RISE);
            mesh.position.lerpVectors(die.presentFrom, pose.position, k);
            mesh.quaternion.copy(die.presentQuat).slerp(pose.quaternion, k);
          } else if (die.t < PRESENT_RISE + PRESENT_HOLD) {
            // Track the camera while held, so the faces keep looking at the viewer.
            mesh.position.lerp(pose.position, Math.min(1, delta * 12));
            mesh.quaternion.slerp(pose.quaternion, Math.min(1, delta * 12));
          } else if (die.t < total) {
            const k = easeInOut((die.t - PRESENT_RISE - PRESENT_HOLD) / PRESENT_RETURN);
            mesh.position.lerpVectors(pose.position, die.end, k);
            mesh.quaternion.copy(pose.quaternion).slerp(die.finalQuat, k);
          } else {
            die.mode = "rest";
            mesh.castShadow = true;
            mesh.position.copy(die.end);
            mesh.quaternion.copy(die.finalQuat);
          }
          break;
        }
      }
      if (!die.landed) allLanded = false;
      if (die.mode !== "rest") allPresented = false;
    });
    if (activeThrow.current === null) return;
    // Both on the felt: start the close-up.
    if (allLanded && dice.current.every((d) => d.mode === "fly")) {
      dice.current.forEach((die, i) => {
        const mesh = meshes[i]?.current;
        die.mode = "present";
        die.t = 0;
        die.presentFrom = mesh ? mesh.position.clone() : die.end.clone();
        die.presentQuat = mesh ? mesh.quaternion.clone() : die.finalQuat.clone();
        if (mesh) mesh.castShadow = false;
      });
      sfx.play("cardDraw", { volume: 0.5, rate: 1.4 });
      return;
    }
    // Space/Enter: skip the hold and drop the dice back now.
    if (diceHurry.requested !== hurrySeen.current) {
      hurrySeen.current = diceHurry.requested;
      for (const die of dice.current) {
        if (die.mode === "present" && die.t < PRESENT_RISE + PRESENT_HOLD) die.t = PRESENT_RISE + PRESENT_HOLD;
      }
    }
    if (allPresented) {
      const id = activeThrow.current;
      activeThrow.current = null;
      onSettled(id);
    }
  });

  return (
    <group>
      {meshes.map((ref, i) => (
        <mesh key={i} ref={ref} castShadow position={[i === 0 ? -0.9 : 0.9, restY, 3]}>
          <boxGeometry args={[SIZE, SIZE, SIZE]} />
          {faces.map((face, f) => (
            <meshStandardMaterial key={f} attach={`material-${f}`} map={face} roughness={0.35} />
          ))}
        </mesh>
      ))}
    </group>
  );
}

/** Where the dice hover while being shaken: above the seat, one per hand. */
function handPosition(frame: SeatFrame, index: number, tableY: number): Vector3 {
  const point = seatPoint(frame, index === 0 ? -0.55 : 0.55, 0.6);
  const [x, y, z] = boardToWorld(point, tableY + HAND_HEIGHT);
  return new Vector3(x, y, z);
}
