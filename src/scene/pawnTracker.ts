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
