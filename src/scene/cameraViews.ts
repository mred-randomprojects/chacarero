import type { HexLayout } from "./hexLayout";
import type { SeatFrame } from "./seats";
import { seatFrame, seatPoint } from "./seats";
import { boardToWorld } from "./tileGeometry";

/** A camera pose: where it stands and what it looks at, in world space. */
export interface CameraView {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

const SEAT_DISTANCE = 18;
const SEAT_HEIGHT = 21;
const SEAT_LOOK_IN = 4.5;

/** Standing behind a seat, with that player's cards in the foreground. */
export function seatView(layout: HexLayout, slabMargin: number, side: number): CameraView {
  const frame: SeatFrame = seatFrame(layout, slabMargin, side);
  const eye = seatPoint(frame, 0, -SEAT_DISTANCE);
  const look = seatPoint(frame, 0, SEAT_LOOK_IN);
  return { position: boardToWorld(eye, SEAT_HEIGHT), target: boardToWorld(look, 0) };
}

/** High and centred, the whole table in view. */
export const OVERVIEW: CameraView = { position: [0, 36, 24], target: [0, 0, 2] };

/** Almost straight down, for reading every tile at once (a small offset keeps lookAt well-defined). */
export const TOP_DOWN: CameraView = { position: [0, 44, 4], target: [0, 0, 0] };

/**
 * Rotates a view around its target by `angle` radians (positive = the camera
 * moves to the viewer's left), keeping height and distance.
 */
export function orbitView(view: CameraView, angle: number): CameraView {
  const [px, py, pz] = view.position;
  const [tx, ty, tz] = view.target;
  const dx = px - tx;
  const dz = pz - tz;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { position: [tx + dx * cos - dz * sin, py, tz + dx * sin + dz * cos], target: [tx, ty, tz] };
}

/** Moves the camera closer to (factor < 1) or further from (factor > 1) its target. */
export function zoomView(view: CameraView, factor: number, min = 3, max = 70): CameraView {
  const [px, py, pz] = view.position;
  const [tx, ty, tz] = view.target;
  const dx = px - tx;
  const dy = py - ty;
  const dz = pz - tz;
  const distance = Math.hypot(dx, dy, dz);
  const next = Math.min(max, Math.max(min, distance * factor));
  const k = next / distance;
  return { position: [tx + dx * k, ty + dy * k, tz + dz * k], target: view.target };
}

/**
 * Backs the camera off along its own line of sight so that something floating
 * `ahead` units in front of it (a card held up to the screen) sits above
 * `clearance`: at least `factor` further away, more when the camera is low.
 * The direction is kept, so whatever it looked at stays centred.
 */
export function backOffView(view: CameraView, factor: number, ahead: number, clearance: number): CameraView {
  const [px, py, pz] = view.position;
  const [tx, ty, tz] = view.target;
  const distance = Math.hypot(px - tx, py - ty, pz - tz);
  if (distance < 1e-6) return view;
  // Height lost per unit travelled along the view direction.
  const drop = (py - ty) / distance;
  const height = clearance + ahead * drop;
  const needed = drop > 1e-6 ? (height - ty) / drop / distance : factor;
  return zoomView(view, Math.max(factor, needed));
}

/** True when `a` is within `position`/`target` units of `b`: close enough that flying there would show nothing. */
export function viewsMatch(a: CameraView, b: CameraView, position = 0.75, target = 0.5): boolean {
  const gap = (u: readonly [number, number, number], v: readonly [number, number, number]) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  return gap(a.position, b.position) <= position && gap(a.target, b.target) <= target;
}

/** Tilts the camera up or down around its target, clamped so it never goes below the table. */
export function tiltView(view: CameraView, angle: number): CameraView {
  const [px, py, pz] = view.position;
  const [tx, ty, tz] = view.target;
  const dx = px - tx;
  const dy = py - ty;
  const dz = pz - tz;
  const horizontal = Math.hypot(dx, dz);
  const distance = Math.hypot(horizontal, dy);
  const polar = Math.atan2(horizontal, dy);
  const next = Math.min(Math.PI * 0.45, Math.max(0.15, polar + angle));
  const h = Math.sin(next) * distance;
  const y = Math.cos(next) * distance;
  const scale = horizontal > 1e-6 ? h / horizontal : 0;
  return { position: [tx + dx * scale, ty + y, tz + dz * scale], target: view.target };
}

/**
 * Close-up of the pawn standing on `square`: from just outside the ring,
 * low enough that the piece fills the foreground, with the board beyond it.
 */
export function pawnView(layout: HexLayout, square: number): CameraView {
  const tile = layout.tiles[square];
  if (!tile) throw new Error(`No tile ${square}`);
  const outward = { x: -tile.up.x, y: -tile.up.y };
  const eye = { x: tile.center.x + outward.x * 4.2, y: tile.center.y + outward.y * 4.2 };
  // Aim just past the piece so it sits in the lower-middle of the frame, above the HUD cards.
  const look = { x: tile.center.x + tile.up.x * 0.5, y: tile.center.y + tile.up.y * 0.5 };
  return { position: boardToWorld(eye, 3.1), target: boardToWorld(look, 0.45) };
}

/** Close-up of one tile, from outside the board so its text reads the right way up. */
export function squareView(layout: HexLayout, index: number): CameraView {
  const tile = layout.tiles[index];
  if (!tile) throw new Error(`No tile ${index}`);
  const outward = { x: -tile.up.x, y: -tile.up.y };
  const eye = { x: tile.center.x + outward.x * 4.5, y: tile.center.y + outward.y * 4.5 };
  return { position: boardToWorld(eye, 5.5), target: boardToWorld(tile.center, 0) };
}
