import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { CameraView } from "./cameraViews";
import { orbitView, tiltView, zoomView } from "./cameraViews";
import { pawnTracker } from "./pawnTracker";

export interface CameraRigProps {
  /** Changing `id` flies the camera to `view`. */
  readonly goTo: { readonly id: number; readonly view: CameraView; readonly seconds?: number } | null;
  /** While true the orbit target tracks the moving pawn (see pawnTracker). */
  readonly followPawn: boolean;
}

/** Flight length for presets (seats, overview). Relative nudges use QUICK. */
const FLIGHT_SECONDS = 0.7;
const QUICK_SECONDS = 0.3;
/** Camera offset while chasing a pawn: close and fairly steep, so the tile is readable. */
const CHASE_DISTANCE = 11;
const CHASE_HEIGHT = 9;

function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Orbit controls plus smooth flights to preset views. Mouse/touch orbiting
 * keeps working between flights; a flight in progress is cancelled by any
 * drag so the user always wins.
 */
export function CameraRig({ goTo, followPawn }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const flight = useRef<{ t: number; seconds: number; from: CameraView; to: CameraView } | null>(null);
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
    flight.current = { t: 0, seconds: goTo.seconds ?? FLIGHT_SECONDS, from: here(), to: goTo.view };
  }, [goTo, here]);

  // Start or stop chasing the pawn. The chase keeps the current azimuth but
  // moves in close; when it ends the camera simply stays where the pawn stopped.
  useEffect(() => {
    if (!followPawn) {
      chase.current = null;
      return;
    }
    const orbit = controls.current;
    if (!orbit) return;
    flight.current = null;
    const offset = new Vector3().subVectors(camera.position, orbit.target);
    offset.y = 0;
    if (offset.lengthSq() < 1e-6) offset.set(0, 0, 1);
    offset.setLength(CHASE_DISTANCE);
    offset.y = CHASE_HEIGHT;
    chase.current = offset;
    settle.current = 0.7;
  }, [followPawn, camera]);

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
      flight.current = { t: 0, seconds: QUICK_SECONDS, from: here(), to };
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

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    const offset = chase.current;
    if (offset) {
      if (pawnTracker.moving) settle.current = 0.7;
      else settle.current -= delta;
      if (pawnTracker.moving || settle.current > 0) {
        const k = 1 - Math.exp(-delta * 7);
        orbit.target.lerp(pawnTracker.position, k);
        camera.position.lerp(new Vector3().addVectors(orbit.target, offset), k);
        orbit.update();
        return;
      }
    }
    const current = flight.current;
    if (!current) return;
    current.t = Math.min(current.seconds, current.t + delta);
    const k = easeInOut(current.t / current.seconds);
    const lerp = (a: readonly [number, number, number], b: readonly [number, number, number]) =>
      new Vector3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    camera.position.copy(lerp(current.from.position, current.to.position));
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
      onStart={() => {
        flight.current = null;
        chase.current = null;
      }}
    />
  );
}
