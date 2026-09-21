import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { sfx } from "../audio/sfx";
import type { TokenId } from "../game";
import type { HexLayout } from "./hexLayout";
import { pawnPosition } from "./hexLayout";
import { pawnKnocks } from "./pawnKnocks";
import { PAWN_SPACING_RATIO } from "./pawnSpots";
import { pawnTracker } from "./pawnTracker";
import { boardToWorld } from "./tileGeometry";
import { TokenShape } from "./Token";

export interface PawnProps {
  readonly layout: HexLayout;
  /** Ring index the pawn should end up on. */
  readonly position: number;
  /** Squares to walk through to get there (first = where it starts); a new `routeId` starts the walk. */
  readonly route: readonly number[] | null;
  readonly routeId: number;
  /** True for a leap straight to the last square (jail). */
  readonly jump: boolean;
  readonly token: TokenId;
  readonly color: string;
  /** 0-5, which of the six spots on a tile this pawn occupies. */
  readonly slot: number;
  readonly y: number;
  /** Key under which dice report a bump (the player id). */
  readonly knockId: string;
  readonly dimmed?: boolean;
  /** Called once the pawn finishes its route. */
  readonly onArrive?: (square: number) => void;
}

/** Squares per second while hopping. */
const SPEED = 6;
const HOP_HEIGHT = 0.55;
const JUMP_HEIGHT = 2.2;
/** How long a pawn wobbles after a die bumps it. */
const KNOCK_SECONDS = 0.8;

/**
 * A player's piece (see Token.tsx for the shapes) that hops along `route`.
 * Movement runs in the frame loop; React only hands over the route. While
 * walking it reports its position to the camera tracker and clicks on every
 * square.
 */
export function Pawn({ layout, position, route, routeId, jump, token, color, slot, y, knockId, dimmed = false, onArrive }: PawnProps) {
  const group = useRef<Group>(null);
  const path = useRef<number[]>([position]);
  const isJump = useRef(false);
  const progress = useRef(0);
  const seenRoute = useRef(routeId);
  const lastStep = useRef(0);
  const spacing = layout.tileWidth * PAWN_SPACING_RATIO;

  useEffect(() => {
    if (routeId === seenRoute.current) return;
    seenRoute.current = routeId;
    if (!route || route.length < 2) {
      path.current = [position];
      progress.current = 0;
      return;
    }
    const displayed = path.current[Math.floor(progress.current)] ?? position;
    // If the pawn is not where the route starts (e.g. state injected), leap there first.
    path.current = displayed === route[0] ? [...route] : [displayed, ...route];
    isJump.current = jump;
    progress.current = 0;
    lastStep.current = 0;
    pawnTracker.moving = true;
  }, [route, routeId, jump, position]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const steps = path.current.length - 1;
    const wasMoving = progress.current < steps;
    if (wasMoving) progress.current = Math.min(steps, progress.current + delta * SPEED);
    const t = progress.current;
    const from = Math.floor(t);
    const frac = t - from;
    const tileA = layout.tiles[path.current[from] ?? position];
    const tileB = layout.tiles[path.current[Math.min(from + 1, steps)] ?? position];
    if (!tileA || !tileB) return;
    const a = pawnPosition(tileA, slot, spacing);
    const b = pawnPosition(tileB, slot, spacing);
    const height = isJump.current ? JUMP_HEIGHT : HOP_HEIGHT;
    const hop = frac > 0 ? Math.sin(frac * Math.PI) * height : 0;
    const [wx, wy, wz] = boardToWorld({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac }, y + hop);
    node.position.set(wx, wy, wz);
    // A die just hit us: rock in the direction of the shove, settling back upright.
    const knock = pawnKnocks.get(knockId);
    if (knock) {
      knock.t += delta;
      if (knock.t >= KNOCK_SECONDS) {
        pawnKnocks.delete(knockId);
        node.rotation.set(0, 0, 0);
      } else {
        const fade = 1 - knock.t / KNOCK_SECONDS;
        const angle = Math.sin(knock.t * 22) * 0.45 * fade * fade;
        // Tilt about the horizontal axis perpendicular to the shove.
        node.rotation.set(-knock.dir.z * angle, 0, knock.dir.x * angle);
      }
    }
    if (wasMoving) {
      pawnTracker.position.set(wx, y, wz);
      if (from > lastStep.current || progress.current >= steps) {
        lastStep.current = from;
        sfx.play("hop", { volume: 0.5, rate: 0.9 + Math.random() * 0.2 });
      }
      if (progress.current >= steps) {
        pawnTracker.moving = false;
        onArrive?.(position);
      }
    }
  });

  return (
    <group ref={group}>
      <TokenShape token={token} color={color} dimmed={dimmed} />
    </group>
  );
}
