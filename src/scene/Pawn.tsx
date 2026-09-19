import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { sfx } from "../audio/sfx";
import type { HexLayout } from "./hexLayout";
import { pawnPosition } from "./hexLayout";
import { pawnTracker } from "./pawnTracker";
import { boardToWorld } from "./tileGeometry";

export interface PawnProps {
  readonly layout: HexLayout;
  /** Ring index the pawn should end up on. */
  readonly position: number;
  /** Squares to walk through to get there (first = where it starts); a new `routeId` starts the walk. */
  readonly route: readonly number[] | null;
  readonly routeId: number;
  /** True for a leap straight to the last square (jail). */
  readonly jump: boolean;
  readonly color: string;
  /** 0-5, which of the six spots on a tile this pawn occupies. */
  readonly slot: number;
  readonly y: number;
  readonly dimmed?: boolean;
  /** Called once the pawn finishes its route. */
  readonly onArrive?: (square: number) => void;
}

/** Squares per second while hopping. */
const SPEED = 6;
const HOP_HEIGHT = 0.55;
const JUMP_HEIGHT = 2.2;

/**
 * A simple pawn (base + body + head) that hops along `route`. Movement runs
 * in the frame loop; React only hands over the route. While walking it
 * reports its position to the camera tracker and clicks on every square.
 */
export function Pawn({ layout, position, route, routeId, jump, color, slot, y, dimmed = false, onArrive }: PawnProps) {
  const group = useRef<Group>(null);
  const path = useRef<number[]>([position]);
  const isJump = useRef(false);
  const progress = useRef(0);
  const seenRoute = useRef(routeId);
  const lastStep = useRef(0);
  const spacing = layout.tileWidth * 0.36;

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

  const opacity = dimmed ? 0.35 : 1;
  return (
    <group ref={group}>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.12, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} transparent={dimmed} opacity={opacity} />
      </mesh>
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.1, 0.2, 0.56, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} transparent={dimmed} opacity={opacity} />
      </mesh>
      <mesh castShadow position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.17, 24, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} transparent={dimmed} opacity={opacity} />
      </mesh>
    </group>
  );
}
