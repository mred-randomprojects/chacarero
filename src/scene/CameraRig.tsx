import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";
import type { CameraView } from "./cameraViews";
import { orbitView, tiltView, zoomView } from "./cameraViews";

export interface CameraRigProps {
  /** Changing `id` flies the camera to `view`. */
  readonly goTo: { readonly id: number; readonly view: CameraView } | null;
}

const FLIGHT_SECONDS = 0.9;

function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Orbit controls plus smooth flights to preset views. Mouse/touch orbiting
 * keeps working between flights; a flight in progress is cancelled by any
 * drag so the user always wins.
 */
export function CameraRig({ goTo }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const flight = useRef<{ t: number; from: CameraView; to: CameraView } | null>(null);
  const lastId = useRef<number | null>(null);

  useEffect(() => {
    if (!goTo || goTo.id === lastId.current) return;
    lastId.current = goTo.id;
    const target = controls.current?.target ?? new Vector3();
    flight.current = {
      t: 0,
      from: { position: [camera.position.x, camera.position.y, camera.position.z], target: [target.x, target.y, target.z] },
      to: goTo.view,
    };
  }, [goTo, camera]);

  // Relative moves (orbit, tilt, zoom) start from wherever the camera is now.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const orbit = controls.current;
      if (!orbit) return;
      // Repeated presses chain from where the current flight is heading, so
      // holding a key keeps turning instead of restarting each time.
      const here: CameraView = flight.current?.to ?? {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [orbit.target.x, orbit.target.y, orbit.target.z],
      };
      let to: CameraView | null = null;
      switch (event.key) {
        case "ArrowLeft":
          to = orbitView(here, -Math.PI / 12);
          break;
        case "ArrowRight":
          to = orbitView(here, Math.PI / 12);
          break;
        case "ArrowUp":
          to = tiltView(here, -0.12);
          break;
        case "ArrowDown":
          to = tiltView(here, 0.12);
          break;
        case "+":
        case "=":
          to = zoomView(here, 0.82);
          break;
        case "-":
        case "_":
          to = zoomView(here, 1.22);
          break;
        default:
          return;
      }
      event.preventDefault();
      const from: CameraView = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [orbit.target.x, orbit.target.y, orbit.target.z],
      };
      flight.current = { t: 0, from, to };
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [camera]);

  useFrame((_, delta) => {
    const current = flight.current;
    const orbit = controls.current;
    if (!current || !orbit) return;
    current.t = Math.min(FLIGHT_SECONDS, current.t + delta);
    const k = easeInOut(current.t / FLIGHT_SECONDS);
    const lerp = (a: readonly [number, number, number], b: readonly [number, number, number]) =>
      new Vector3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    camera.position.copy(lerp(current.from.position, current.to.position));
    orbit.target.copy(lerp(current.from.target, current.to.target));
    orbit.update();
    if (current.t >= FLIGHT_SECONDS) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={10}
      maxDistance={70}
      maxPolarAngle={Math.PI * 0.45}
      onStart={() => {
        flight.current = null;
      }}
    />
  );
}
