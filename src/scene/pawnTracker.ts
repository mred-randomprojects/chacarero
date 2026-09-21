import { Vector3 } from "three";

/**
 * Whatever is moving on the table right now — a walking pawn, a deed or a
 * bill in flight — written every frame by the thing itself and read by the
 * camera rig when it is following. A plain shared object avoids pushing 60
 * updates a second through React.
 */
export const pawnTracker = {
  position: new Vector3(),
  /** True while something is mid-motion. */
  moving: false,
  /** What is moving: the camera sits behind a pawn (outside the ring), and keeps its angle for a flight. */
  kind: "pawn" as "pawn" | "flight",
  /** For a pawn: unit vector from the board centre out through its square (world XZ), so the camera can stay outside the ring. */
  outward: new Vector3(0, 0, 1),
};

/**
 * Where the camera is and what it looks at, written every frame by the rig
 * so the director (outside the canvas) can start flights from here.
 */
export const cameraTracker = {
  position: new Vector3(0, 36, 24),
  target: new Vector3(0, 0, 2),
};
