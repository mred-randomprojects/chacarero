import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { Quaternion, Vector3 } from "three";
import { FACE_VALUES, diceFaceTexture, faceNormal } from "./diceFaces";
import type { SeatFrame } from "./seats";
import { seatPoint } from "./seats";
import { boardToWorld } from "./tileGeometry";

export interface DiceThrow {
  readonly id: number;
  readonly values: readonly [number, number];
}

export interface DiceProps {
  /** Seat of the player holding the dice. */
  readonly frame: SeatFrame;
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

type Mode = "rest" | "shake" | "fly";

interface DieState {
  mode: Mode;
  /** Seconds since the throw started. */
  t: number;
  start: Vector3;
  end: Vector3;
  spinAxis: Vector3;
  spinSpeed: number;
  spinQuat: Quaternion;
  finalQuat: Quaternion;
  landed: boolean;
}

function randomUnit(): Vector3 {
  return new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
}

/** Orientation that shows `value` on top, with a random spin about the vertical. */
function restingQuaternion(value: number): Quaternion {
  const q = new Quaternion().setFromUnitVectors(faceNormal(value), UP);
  const yaw = new Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2);
  return yaw.multiply(q);
}

/** Landing spot on the felt, in world space, with the two dice kept apart. */
function landingSpot(index: number): Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const radius = 2.6 + Math.random() * 2;
  const x = Math.cos(angle) * radius + (index === 0 ? -0.9 : 0.9);
  const z = Math.sin(angle) * radius;
  return new Vector3(x, 0, z);
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
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
 * rattle above the current player's seat while `shaking`, and fly to the
 * middle of the board on a throw, tumbling and settling on the rolled faces.
 */
export function Dice({ frame, shaking, throwing, tableY, onSettled }: DiceProps) {
  const meshes = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const faces = useMemo(() => FACE_VALUES.map((value) => diceFaceTexture(value)), []);
  useEffect(() => () => faces.forEach((f) => f.dispose()), [faces]);

  const dice = useRef<DieState[]>(
    [0, 1].map((i) => ({
      mode: "rest",
      t: 0,
      start: new Vector3(),
      end: landingSpot(i).setY(tableY + HALF),
      spinAxis: randomUnit(),
      spinSpeed: 0,
      spinQuat: restingQuaternion(1 + i),
      finalQuat: restingQuaternion(1 + i),
      landed: true,
    })),
  );
  const activeThrow = useRef<number | null>(null);
  const restY = tableY + HALF;

  useEffect(() => {
    if (!throwing || throwing.id === activeThrow.current) return;
    activeThrow.current = throwing.id;
    dice.current.forEach((die, i) => {
      const mesh = meshes[i]?.current;
      const value = throwing.values[i] ?? 1;
      die.mode = "fly";
      die.t = 0;
      die.start = mesh ? mesh.position.clone() : handPosition(frame, i, tableY);
      die.end = landingSpot(i).setY(restY);
      die.spinAxis = randomUnit();
      die.spinSpeed = 14 + Math.random() * 8;
      die.spinQuat = mesh ? mesh.quaternion.clone() : new Quaternion();
      die.finalQuat = restingQuaternion(value);
      die.landed = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meshes are stable refs
  }, [throwing, frame, tableY, restY]);

  useEffect(() => {
    for (const die of dice.current) {
      if (die.mode === "fly") continue;
      die.mode = shaking ? "shake" : "rest";
    }
  }, [shaking]);

  useFrame((_, delta) => {
    let allLanded = true;
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
            die.mode = "rest";
            mesh.quaternion.copy(die.finalQuat);
          }
          break;
        }
      }
      if (!die.landed) allLanded = false;
    });
    if (allLanded && activeThrow.current !== null) {
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
