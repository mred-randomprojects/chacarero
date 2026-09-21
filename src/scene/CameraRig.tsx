import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { CameraView } from "./cameraViews";
import { orbitView, tiltView, zoomView } from "./cameraViews";
import { cameraTracker, pawnTracker } from "./pawnTracker";
import { pace } from "../ui/pace";

export type FlightStyle = "direct" | "arc";

/** Where a flight goes; without `position` the camera stays put and only turns towards `target`. */
export interface FlightView {
  readonly position?: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export interface CameraRigProps {
  /** Changing `id` flies the camera to `view`; an `arc` flight rises away from the table and dives back in. */
  readonly goTo: { readonly id: number; readonly view: FlightView; readonly seconds?: number; readonly style?: FlightStyle } | null;
  /**
   * The walk to chase, by id (see pawnTracker): every new id restarts the
   * chase, so a second move in the same action is followed even when the
   * landing flight of the first one had taken the camera. Null: no chase.
   */
  readonly chase: number | null;
  /** The user grabbed the camera (drag, wheel or a camera key): the director should let go. */
  readonly onUserControl: () => void;
}

/** Flight length for presets (seats, overview). Relative nudges use QUICK. */
const FLIGHT_SECONDS = 0.7;
const QUICK_SECONDS = 0.3;
/** Height an arc flight climbs at its midpoint, as a share of the distance flown (clamped). */
const ARC_RISE = 0.45;
/** Camera offset while chasing a pawn: close behind it, outside the ring, low enough to see the piece hop. */
const CHASE_DISTANCE = 4.6;
const CHASE_HEIGHT = 3.3;
/** While following a flight (a deed, bills) the camera keeps its angle and hangs back a little more. */
const FLIGHT_DISTANCE = 6.5;
const FLIGHT_HEIGHT = 4.5;

function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Slow start, fast middle, soft landing: the arc accelerates away and brakes into the new pawn. */
function easeInOutQuart(x: number): number {
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

/**
 * Orbit controls plus smooth flights to preset views. Mouse/touch orbiting
 * keeps working between flights; a flight in progress is cancelled by any
 * drag so the user always wins.
 */
export function CameraRig({ goTo, chase: chaseId, onUserControl }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const flight = useRef<{ t: number; seconds: number; from: CameraView; to: CameraView; style: FlightStyle } | null>(null);
  const userControl = useRef(onUserControl);
  userControl.current = onUserControl;
  const lastId = useRef<number | null>(null);
  /** Camera offset from the target while chasing; null when not chasing. */
  const chase = useRef<Vector3 | null>(null);
  /** Seconds left of chasing after the pawn stopped, so the camera settles on it. */
  const settle = useRef(0);
  const grab = useRef<{ point: Vector3; moved: boolean; startX: number; startY: number } | null>(null);

  const here = useCallback((): CameraView => {
    const target = controls.current?.target ?? new Vector3();
    return { position: [camera.position.x, camera.position.y, camera.position.z], target: [target.x, target.y, target.z] };
  }, [camera]);

  useEffect(() => {
    if (!goTo || goTo.id === lastId.current) return;
    lastId.current = goTo.id;
    chase.current = null;
    const from = here();
    const to: CameraView = { position: goTo.view.position ?? from.position, target: goTo.view.target };
    const seconds = goTo.seconds ?? FLIGHT_SECONDS;
    if (seconds <= 0) {
      // A snap: no flight at all.
      flight.current = null;
      const orbit = controls.current;
      camera.position.set(...to.position);
      if (orbit) {
        orbit.target.set(...to.target);
        orbit.update();
      }
      return;
    }
    flight.current = { t: 0, seconds, from, to, style: goTo.style ?? "direct" };
  }, [goTo, here, camera]);

  // Taking the camera means dragging it or using the wheel. A plain click (selecting a square)
  // is not that, so it neither cancels a flight nor hands the camera to the user. The drag is
  // watched on the window (button held, moved a few pixels) so pointer capture cannot hide it.
  useEffect(() => {
    let down: { x: number; y: number } | null = null;
    const takeOver = () => {
      flight.current = null;
      chase.current = null;
      userControl.current();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.altKey || event.button !== 0) return;
      down = { x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!down) return;
      if ((event.buttons & 1) === 0) {
        down = null;
        return;
      }
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) {
        down = null;
        takeOver();
      }
    };
    const onPointerUp = () => {
      down = null;
    };
    const onWheel = () => takeOver();
    domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    domElement.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      domElement.removeEventListener("wheel", onWheel);
    };
  }, [domElement]);

  // Start or stop chasing whatever moves. A pawn is chased from behind (outside
  // the ring, the offset following its square); a flight keeps the camera's
  // current angle. When it ends the camera simply stays where the motion stopped.
  useEffect(() => {
    if (chaseId === null) {
      chase.current = null;
      return;
    }
    const orbit = controls.current;
    if (!orbit) return;
    flight.current = null;
    const offset = new Vector3().subVectors(camera.position, orbit.target);
    offset.y = 0;
    if (offset.lengthSq() < 1e-6) offset.set(0, 0, 1);
    offset.setLength(FLIGHT_DISTANCE);
    offset.y = FLIGHT_HEIGHT;
    chase.current = offset;
    settle.current = 0.7;
  }, [chaseId, camera]);

  // Relative moves (orbit, tilt, zoom) start from wherever the camera is now.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const orbit = controls.current;
      if (!orbit) return;
      // Repeated presses chain from where the current flight is heading, so
      // holding a key keeps turning instead of restarting each time.
      const base: CameraView = flight.current?.to ?? here();
      let to: CameraView | null = null;
      switch (event.key) {
        case "ArrowLeft":
          to = orbitView(base, -Math.PI / 12);
          break;
        case "ArrowRight":
          to = orbitView(base, Math.PI / 12);
          break;
        case "ArrowUp":
          to = tiltView(base, -0.12);
          break;
        case "ArrowDown":
          to = tiltView(base, 0.12);
          break;
        case "+":
        case "=":
          to = zoomView(base, 0.75);
          break;
        case "-":
        case "_":
          to = zoomView(base, 1.33);
          break;
        default:
          return;
      }
      event.preventDefault();
      chase.current = null;
      userControl.current();
      flight.current = { t: 0, seconds: QUICK_SECONDS, from: here(), to, style: "direct" };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [here]);

  // Alt/Option + drag grabs the table and slides it under the cursor (the
  // point you grabbed stays under the pointer); a plain Alt+click re-centres
  // on that point instead.
  useEffect(() => {
    const raycaster = new Raycaster();
    const ground = new Plane(new Vector3(0, 1, 0), 0);
    const hitAt = (event: PointerEvent): Vector3 | null => {
      const rect = domElement.getBoundingClientRect();
      const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = new Vector3();
      return raycaster.ray.intersectPlane(ground, hit) ? hit : null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.altKey || event.button !== 0) return;
      const point = hitAt(event);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      chase.current = null;
      flight.current = null;
      userControl.current();
      grab.current = { point, moved: false, startX: event.clientX, startY: event.clientY };
      domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const current = grab.current;
      const orbit = controls.current;
      if (!current || !orbit) return;
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 4) current.moved = true;
      if (!current.moved) return;
      const hit = hitAt(event);
      if (!hit) return;
      const shift = new Vector3().subVectors(current.point, hit);
      camera.position.add(shift);
      orbit.target.add(shift);
      orbit.update();
    };
    const onPointerUp = (event: PointerEvent) => {
      const current = grab.current;
      const orbit = controls.current;
      grab.current = null;
      if (!current || !orbit) return;
      if (current.moved) return;
      const dx = current.point.x - orbit.target.x;
      const dz = current.point.z - orbit.target.z;
      flight.current = {
        t: 0,
        seconds: QUICK_SECONDS,
        from: here(),
        to: { position: [camera.position.x + dx, camera.position.y, camera.position.z + dz], target: [current.point.x, 0, current.point.z] },
        style: "direct",
      };
      event.preventDefault();
    };
    // Capture phase so OrbitControls never sees the Alt+click as the start of a rotate.
    domElement.addEventListener("pointerdown", onPointerDown, { capture: true });
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerup", onPointerUp);
    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown, { capture: true });
      domElement.removeEventListener("pointermove", onPointerMove);
      domElement.removeEventListener("pointerup", onPointerUp);
    };
  }, [camera, domElement, here]);

  useFrame((_, rawDelta) => {
    const orbit = controls.current;
    if (!orbit) return;
    cameraTracker.position.copy(camera.position);
    cameraTracker.target.copy(orbit.target);
    // The camera keeps up with a hurried replay: same lag behind the pawn, same flights, in replay time.
    const delta = rawDelta * pace.rate;
    const offset = chase.current;
    if (offset) {
      if (pawnTracker.moving) settle.current = 0.7;
      else settle.current -= delta;
      if (pawnTracker.moving || settle.current > 0) {
        // Behind a pawn: outside the ring through its square, glancing inward across the board.
        const behind = pawnTracker.kind === "pawn" ? pawnTracker.outward.clone().multiplyScalar(CHASE_DISTANCE).setY(CHASE_HEIGHT) : offset;
        const k = 1 - Math.exp(-delta * 4.5);
        const look = pawnTracker.position.clone();
        look.y += 0.3;
        orbit.target.lerp(look, k);
        camera.position.lerp(new Vector3().addVectors(look, behind), k);
        orbit.update();
        return;
      }
    }
    const current = flight.current;
    if (!current) return;
    current.t = Math.min(current.seconds, current.t + delta);
    const arc = current.style === "arc";
    const k = (arc ? easeInOutQuart : easeInOut)(current.t / current.seconds);
    const lerp = (a: readonly [number, number, number], b: readonly [number, number, number]) =>
      new Vector3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    camera.position.copy(lerp(current.from.position, current.to.position));
    if (arc) {
      // Climb away from the table on the way out, dive back in on the way down.
      const span = Math.hypot(current.to.position[0] - current.from.position[0], current.to.position[2] - current.from.position[2]);
      camera.position.y += Math.min(14, Math.max(3, span * ARC_RISE)) * Math.sin(k * Math.PI);
    }
    orbit.target.copy(lerp(current.from.target, current.to.target));
    orbit.update();
    if (current.t >= current.seconds) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan
      screenSpacePanning={false}
      panSpeed={0.8}
      minDistance={3}
      maxDistance={70}
      maxPolarAngle={Math.PI * 0.47}
    />
  );
}
