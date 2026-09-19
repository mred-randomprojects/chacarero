import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { BOARD_SIZE } from "../game";
import type { HexLayout } from "./hexLayout";
import { pawnPosition } from "./hexLayout";
import { boardToWorld } from "./tileGeometry";

export interface PawnProps {
  readonly layout: HexLayout;
  /** Cumulative squares travelled since the start; position on the ring is `steps % 42`. */
  readonly steps: number;
  readonly color: string;
  /** 0-5, which of the six spots on a tile this pawn occupies. */
  readonly slot: number;
  readonly y: number;
  /** Called once the pawn finishes hopping to its target square. */
  readonly onArrive?: (square: number) => void;
}

/** Squares per second while hopping. */
const SPEED = 5;
const HOP_HEIGHT = 0.55;

/**
 * A simple pawn (base + body + head) that hops square by square towards
 * `steps`. Movement is driven by the frame loop; React state only sets the
 * destination, so re-renders never stutter the animation.
 */
export function Pawn({ layout, steps, color, slot, y, onArrive }: PawnProps) {
  const group = useRef<Group>(null);
  const travelled = useRef(steps);
  const arrivedFor = useRef(steps);
  const spacing = layout.tileWidth * 0.36;

  useEffect(() => {
    if (steps < travelled.current) travelled.current = steps;
  }, [steps]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const target = steps;
    if (travelled.current < target) {
      travelled.current = Math.min(target, travelled.current + delta * SPEED);
    }
    const t = travelled.current;
    const from = Math.floor(t);
    const frac = t - from;
    const tileA = layout.tiles[from % BOARD_SIZE];
    const tileB = layout.tiles[(from + 1) % BOARD_SIZE];
    if (!tileA || !tileB) return;
    const a = pawnPosition(tileA, slot, spacing);
    const b = pawnPosition(tileB, slot, spacing);
    const x = a.x + (b.x - a.x) * frac;
    const z = a.y + (b.y - a.y) * frac;
    const hop = frac > 0 ? Math.sin(frac * Math.PI) * HOP_HEIGHT : 0;
    const [wx, wy, wz] = boardToWorld({ x, y: z }, y + hop);
    node.position.set(wx, wy, wz);

    if (t === target && arrivedFor.current !== target) {
      arrivedFor.current = target;
      onArrive?.(target % BOARD_SIZE);
    }
  });

  return (
    <group ref={group} castShadow>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.12, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.1, 0.2, 0.56, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.17, 24, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}
