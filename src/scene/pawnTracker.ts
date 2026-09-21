import { Vector3 } from "three";

/**
 * Where the moving pawn is right now, written every frame by the Pawn and
 * read by the camera rig when it is following. A plain shared object avoids
 * pushing 60 updates a second through React.
 */
export const pawnTracker = {
  position: new Vector3(),
  /** True while some pawn is mid-route. */
  moving: false,
};

/**
 * Where the camera is and what it looks at, written every frame by the rig
 * so the director (outside the canvas) can start flights from here.
 */
export const cameraTracker = {
  position: new Vector3(0, 36, 24),
  target: new Vector3(0, 0, 2),
};
