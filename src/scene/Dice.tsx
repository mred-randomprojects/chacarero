import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { Color, Quaternion, Vector3 } from "three";
import { sfx } from "../audio/sfx";
import { FACE_VALUES, diceFaceTexture, faceNormal } from "./diceFaces";
import type { Obstacle } from "./diceThrow";
import { DIE_SIZE, MIN_SEPARATION, flightHeight, landingSpots, seeded, separate } from "./diceThrow";
import { diceHurry, pawnKnocks } from "./pawnKnocks";

export interface DiceThrow {
  readonly id: number;
  readonly values: readonly [number, number];
  /** Seeds the tumble and landing spots so every screen sees the same throw. */
  readonly seed: number;
}

export type PawnObstacle = Obstacle;

export interface DiceProps {
  /** World point the throw aims at: beside the current player's pawn. */
  readonly target: Vector3;
  /** Every pawn on the board; a die landing on one knocks it. */
  readonly obstacles: readonly Obstacle[];
  /** True while the player is shaking the dice in their hands. */
  readonly shaking: boolean;
  /** A new id starts a throw that ends showing `values`. */
  readonly throwing: DiceThrow | null;
  readonly tableY: number;
  /** Both dice have come to rest on the felt, at `at`: the moment to read them on the table. */
  readonly onLanded: (id: number, at: Vector3) => void;
  /** The dice are up in front of the camera (doubles or not). */
  readonly onPresenting: (id: number, doubles: boolean) => void;
  /** The whole throw, close-up included, is over. */
  readonly onSettled: (id: number) => void;
}

const HALF = DIE_SIZE / 2;
const FLIGHT_SECONDS = 1.25;
/** The second die leaves the hand this much later, so the two never fly as one. */
const STAGGER = 0.09;
const ARC_HEIGHT = 1.1;
const UP = new Vector3(0, 1, 0);
const GOLD = new Color("#f2c21c");
const BLACK = new Color("#000000");
/** Picking the dice up off the felt into the hands. */
const GRAB_SECONDS = 0.5;
/** Shakes per second while rattling in the hands. */
const SHAKE_HZ = 5.5;
/** After landing, the dice lie still this long so everyone reads them on the table before the close-up. */
const REST_SECONDS = 1.5;
/** The close-up: rise, hold, drop back to exactly where they landed. */
const PRESENT_RISE = 0.45;
const PRESENT_HOLD = 0.85;
const PRESENT_RETURN = 0.45;
const PRESENT_DISTANCE = 4.8;
/** The hands: just in front of and below the camera. */
const HAND_DISTANCE = 3.0;
const HAND_DROP = 0.75;

type Mode = "rest" | "grab" | "shake" | "fly" | "settle" | "present";

interface DieState {
  mode: Mode;
  /** Seconds since the current mode began. */
  t: number;
  /** Bounces already voiced during this flight. */
  bounces: number;
  /** Where the current motion started (grab, flight, close-up). */
  from: Vector3;
  fromQuat: Quaternion;
  /** Where the die lies (or will lie) on the felt. */
  end: Vector3;
  spinAxis: Vector3;
  spinSpeed: number;
  spinQuat: Quaternion;
  finalQuat: Quaternion;
  /** Pawn this die bumps when it lands, if any. */
  bumps: Obstacle | null;
  bumped: boolean;
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

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Two physical-looking dice. They lie on the felt where they last landed;
 * when the player grabs them they fly into the hands (just in front of the
 * camera) and rattle there; a throw lobs them onto the felt beside the
 * player's pawn, bouncing, never through each other or through a pawn
 * (a pawn hit is shoved instead); they lie still for a moment so everyone
 * can read them on the table, rise into the camera for the close-up, and
 * drop back exactly where they landed.
 */
export function Dice({ target, obstacles, shaking, throwing, tableY, onLanded, onPresenting, onSettled }: DiceProps) {
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
      from: new Vector3(),
      fromQuat: new Quaternion(),
      end: new Vector3(i === 0 ? -0.9 : 0.9, restY, 3),
      spinAxis: randomUnit(),
      spinSpeed: 0,
      spinQuat: restingQuaternion(1 + i),
      finalQuat: restingQuaternion(1 + i),
      bumps: null,
      bumped: false,
    })),
  );
  const activeThrow = useRef<number | null>(null);
  const landedReported = useRef(false);
  const presentingReported = useRef(false);
  const hurrySeen = useRef(diceHurry.requested);
  const latest = useRef({ target, obstacles, onLanded, onPresenting, onSettled });
  latest.current = { target, obstacles, onLanded, onPresenting, onSettled };

  /** Where die `i` sits in the cupped hands, before the rattle is added. */
  const handPose = (i: number): Vector3 => {
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const hand = camera.position
      .clone()
      .addScaledVector(forward, HAND_DISTANCE)
      .addScaledVector(right, i === 0 ? -0.55 : 0.55)
      .addScaledVector(up, -HAND_DROP);
    hand.y = Math.max(restY + 0.4, hand.y);
    return hand;
  };

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

  // A throw: from wherever the dice are (the hands, normally) to the felt beside the pawn.
  useEffect(() => {
    if (!throwing || throwing.id === activeThrow.current) return;
    activeThrow.current = throwing.id;
    landedReported.current = false;
    presentingReported.current = false;
    hurrySeen.current = diceHurry.requested;
    const random = seeded(throwing.seed * 7919 + 17);
    const { target: aim, obstacles: pawns } = latest.current;
    const landing = landingSpots(aim, pawns, random);
    dice.current.forEach((die, i) => {
      const mesh = meshes[i]?.current;
      const value = throwing.values[i] ?? 1;
      die.mode = "fly";
      die.t = 0;
      die.bounces = 0;
      die.from = mesh ? mesh.position.clone() : handPose(i);
      die.fromQuat = mesh ? mesh.quaternion.clone() : new Quaternion();
      die.end = (landing.spots[i] ?? new Vector3()).clone().setY(restY);
      die.bumps = landing.bumps[i] ?? null;
      die.bumped = false;
      die.spinAxis = randomUnit(random);
      die.spinSpeed = 14 + random() * 8;
      die.spinQuat = die.fromQuat.clone();
      die.finalQuat = restingQuaternion(value, random);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meshes are stable refs
  }, [throwing, restY]);

  // Grabbing the dice (they fly into the hands) and putting them down again.
  useEffect(() => {
    for (const [i, die] of dice.current.entries()) {
      if (die.mode === "fly" || die.mode === "settle" || die.mode === "present") continue;
      const mesh = meshes[i]?.current;
      if (shaking && die.mode !== "shake") {
        die.mode = "grab";
        die.t = 0;
        die.from = mesh ? mesh.position.clone() : die.end.clone();
        die.fromQuat = mesh ? mesh.quaternion.clone() : die.finalQuat.clone();
      } else if (!shaking && die.mode !== "rest") {
        die.mode = "rest";
      }
    }
    if (!shaking) return;
    sfx.play("diceGrab", { volume: 0.7 });
    // The rattle: one clack per shake, once the dice are in the hands.
    const id = setInterval(() => sfx.play("diceShake", { volume: 0.55, rate: 0.95 + Math.random() * 0.1 }), 1000 / SHAKE_HZ);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meshes are stable refs
  }, [shaking]);

  useFrame(({ clock }, delta) => {
    let allLanded = true;
    let allRested = true;
    let allDone = true;
    const positions: Vector3[] = [];
    dice.current.forEach((die, i) => {
      const mesh = meshes[i]?.current;
      if (!mesh) return;
      die.t += delta;
      switch (die.mode) {
        case "rest":
          mesh.position.lerp(die.end, Math.min(1, delta * 10));
          mesh.quaternion.slerp(die.finalQuat, Math.min(1, delta * 10));
          break;
        case "grab": {
          const k = Math.min(1, die.t / GRAB_SECONDS);
          const e = easeInOut(k);
          const hand = handPose(i);
          mesh.position.lerpVectors(die.from, hand, e);
          mesh.position.y += Math.sin(e * Math.PI) * 0.6;
          mesh.quaternion.copy(die.fromQuat).slerp(die.spinQuat, e);
          if (k >= 1) {
            die.mode = "shake";
            die.t = 0;
          }
          break;
        }
        case "shake": {
          // Cupped hands moving as one: a side-to-side rattle with a hop at each turn,
          // the two dice tumbling together with a little slack between them.
          const phase = clock.elapsedTime * SHAKE_HZ * Math.PI * 2;
          const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const hand = handPose(i)
            .addScaledVector(right, Math.sin(phase) * 0.22 + Math.sin(phase * 0.5 + i) * 0.04)
            .addScaledVector(up, Math.abs(Math.sin(phase)) * 0.14 + Math.sin(phase * 2 + i * 1.3) * 0.03)
            .addScaledVector(forward, Math.sin(phase + 1.2 + i) * 0.05);
          mesh.position.lerp(hand, Math.min(1, delta * 22));
          const tumble = new Quaternion().setFromAxisAngle(die.spinAxis, delta * (6 + Math.abs(Math.cos(phase)) * 10));
          die.spinQuat.premultiply(tumble);
          mesh.quaternion.copy(die.spinQuat);
          // The tumble axis drifts a little, so it never looks like a fixed spin.
          die.spinAxis.lerp(randomUnit(), delta * 0.8).normalize();
          break;
        }
        case "fly": {
          const started = Math.max(0, die.t - i * STAGGER);
          const u = Math.min(1, started / FLIGHT_SECONDS);
          // Knocks on the felt: the first landing, then two smaller bounces.
          const knocks = [0.6, 0.8, 0.95];
          while (die.bounces < knocks.length && u >= (knocks[die.bounces] ?? 2)) {
            sfx.play("dieLand", { volume: [0.9, 0.5, 0.3][die.bounces] ?? 0.3, rate: 0.9 + Math.random() * 0.25 });
            die.bounces += 1;
          }
          if (die.bumps && !die.bumped && u >= 0.6) {
            die.bumped = true;
            const dir = new Vector3(die.bumps.position.x - die.end.x, 0, die.bumps.position.z - die.end.z).normalize();
            pawnKnocks.set(die.bumps.id, { t: 0, dir });
            sfx.play("build", { volume: 0.5, rate: 1.3 });
          }
          const ground = easeOutCubic(Math.min(1, u / 0.7));
          mesh.position.x = die.from.x + (die.end.x - die.from.x) * ground;
          mesh.position.z = die.from.z + (die.end.z - die.from.z) * ground;
          mesh.position.y = restY + flightHeight(u, Math.max(0, die.from.y - restY), ARC_HEIGHT);
          if (u < 0.6) {
            const dq = new Quaternion().setFromAxisAngle(die.spinAxis, delta * die.spinSpeed * (1 - u * 0.5));
            die.spinQuat.premultiply(dq);
            mesh.quaternion.copy(die.spinQuat);
          } else {
            const k = easeOutCubic((u - 0.6) / 0.4);
            mesh.quaternion.copy(die.spinQuat).slerp(die.finalQuat, k);
          }
          if (u >= 1) {
            die.mode = "settle";
            die.t = 0;
            mesh.position.copy(die.end);
            mesh.quaternion.copy(die.finalQuat);
          }
          break;
        }
        case "settle":
          // Lying still on the felt where they landed.
          mesh.position.copy(die.end);
          mesh.quaternion.copy(die.finalQuat);
          break;
        case "present": {
          const value = throwing?.values[i] ?? 1;
          const pose = presentPose(i, value);
          const total = PRESENT_RISE + PRESENT_HOLD + PRESENT_RETURN;
          if (die.t < PRESENT_RISE) {
            const k = easeInOut(die.t / PRESENT_RISE);
            mesh.position.lerpVectors(die.from, pose.position, k);
            mesh.quaternion.copy(die.fromQuat).slerp(pose.quaternion, k);
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
      positions.push(mesh.position);
      if (die.mode === "fly") allLanded = false;
      if (die.mode !== "settle" && die.mode !== "rest") allRested = false;
      if (die.mode !== "rest") allDone = false;
    });

    // Solid dice: mid-flight they are kept apart, never through each other (in the hands their poses already are).
    const [a, b] = positions;
    const mode = dice.current[0]?.mode;
    if (a && b && mode === "fly") separate(a, b, MIN_SEPARATION * 0.85);

    // Doubles glow gold while up in front of the camera.
    const doubles = throwing !== null && throwing.values[0] === throwing.values[1];
    const glow = mode === "present" && doubles ? 0.55 + 0.45 * Math.sin(clock.elapsedTime * 9) : 0;
    for (const ref of meshes) {
      const mesh = ref.current;
      if (!mesh) continue;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials as MeshStandardMaterial[]) {
        material.emissive.copy(glow > 0 ? GOLD : BLACK);
        material.emissiveIntensity = glow;
      }
    }

    if (activeThrow.current === null) return;
    const id = activeThrow.current;
    // Both on the felt: everyone reads them there for a moment.
    if (allLanded && !landedReported.current && dice.current.every((d) => d.mode === "settle")) {
      landedReported.current = true;
      const at = new Vector3().addVectors(dice.current[0]?.end ?? new Vector3(), dice.current[1]?.end ?? new Vector3()).multiplyScalar(0.5);
      latest.current.onLanded(id, at);
    }
    // Then the close-up (Space/Enter skips the wait).
    const hurried = diceHurry.requested !== hurrySeen.current;
    if (allRested && dice.current.every((d) => d.mode === "settle") && ((dice.current[0]?.t ?? 0) >= REST_SECONDS || hurried)) {
      hurrySeen.current = diceHurry.requested;
      dice.current.forEach((die, i) => {
        const mesh = meshes[i]?.current;
        die.mode = "present";
        die.t = 0;
        die.from = mesh ? mesh.position.clone() : die.end.clone();
        die.fromQuat = mesh ? mesh.quaternion.clone() : die.finalQuat.clone();
        if (mesh) mesh.castShadow = false;
      });
      sfx.play("cardDraw", { volume: 0.5, rate: 1.4 });
      return;
    }
    if (mode === "present" && !presentingReported.current && (dice.current[0]?.t ?? 0) >= PRESENT_RISE) {
      presentingReported.current = true;
      latest.current.onPresenting(id, doubles);
    }
    // Space/Enter during the hold: drop the dice back now.
    if (mode === "present" && hurried) {
      hurrySeen.current = diceHurry.requested;
      for (const die of dice.current) if (die.t < PRESENT_RISE + PRESENT_HOLD) die.t = PRESENT_RISE + PRESENT_HOLD;
    }
    if (allDone) {
      activeThrow.current = null;
      latest.current.onSettled(id);
    }
  });

  return (
    <group>
      {meshes.map((ref, i) => (
        <mesh key={i} ref={ref} castShadow position={[i === 0 ? -0.9 : 0.9, restY, 3]}>
          <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
          {faces.map((face, f) => (
            <meshStandardMaterial key={f} attach={`material-${f}`} map={face} roughness={0.35} />
          ))}
        </mesh>
      ))}
    </group>
  );
}
