/** The camera's vertical field of view on a landscape screen, in degrees. */
export const BASE_FOV = 45;

/** Below this aspect (width / height) the screen is narrower than the views were framed for. */
export const NARROWEST_FRAMED_ASPECT = 0.75;

/**
 * Vertical field of view for a screen of this aspect. The camera views were
 * framed on landscape screens; a phone held upright would see a thin vertical
 * slice of them (the board cut at both sides), so below the narrowest framed
 * aspect the horizontal field of view is held there and the vertical one
 * opens up instead.
 */
export function fovForAspect(aspect: number): number {
  if (!(aspect > 0) || aspect >= NARROWEST_FRAMED_ASPECT) return BASE_FOV;
  const halfWidth = Math.tan(((BASE_FOV / 2) * Math.PI) / 180) * NARROWEST_FRAMED_ASPECT;
  return ((2 * Math.atan(halfWidth / aspect)) * 180) / Math.PI;
}
