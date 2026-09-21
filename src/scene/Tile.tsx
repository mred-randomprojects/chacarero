import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import { Color } from "three";
import type { Deed, Square } from "../game";
import type { TileLayout } from "./hexLayout";
import { createTileGeometry } from "./tileGeometry";
import { createTileTexture } from "./tileTexture";

export interface TileProps {
  readonly tile: TileLayout;
  readonly square: Square;
  readonly deed: Deed | undefined;
  readonly y: number;
  readonly hovered: boolean;
  readonly selected: boolean;
  /** Position of this square along the pawn's upcoming route (1 = next square), or null. */
  readonly pathStep: number | null;
  /** Length of that route, so the chasing glow knows when to wrap. */
  readonly pathLength: number;
  readonly onHover: (index: number | null) => void;
  readonly onSelect: (index: number) => void;
  readonly onFocus: (index: number) => void;
}

const GOLD = new Color("#ffd166");
const WHITE = new Color("#ffffff");
const BLACK = new Color("#000000");
/** Squares per second the chasing glow travels along the route. */
const CHASE_SPEED = 4;

/**
 * One square of the ring: a flat polygon with its face drawn on a canvas.
 * Hover/selection are shown by tinting the material's emissive channel; a
 * square on the pawn's upcoming route glows gold with a pulse that runs
 * square by square towards the destination.
 */
export function Tile({ tile, square, deed, y, hovered, selected, pathStep, pathLength, onHover, onSelect, onFocus }: TileProps) {
  const geometry = useMemo(() => createTileGeometry(tile, y), [tile, y]);
  const texture = useMemo(() => createTileTexture(tile, square, deed), [tile, square, deed]);
  const material = useRef<MeshStandardMaterial>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    const mat = material.current;
    if (!mat) return;
    if (pathStep !== null) {
      // A pulse chases along the route; the destination holds a steadier glow.
      const cycle = pathLength + 2;
      const phase = (clock.elapsedTime * CHASE_SPEED) % cycle;
      const distance = Math.abs(phase - pathStep);
      const pulse = Math.max(0, 1 - distance);
      const base = pathStep === pathLength ? 0.3 : 0.12;
      mat.emissive.copy(GOLD);
      mat.emissiveIntensity = base + pulse * 0.5;
      return;
    }
    mat.emissive.copy(selected ? GOLD : hovered ? WHITE : BLACK);
    mat.emissiveIntensity = selected ? 0.35 : hovered ? 0.18 : 0;
  });

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        onHover(square.index);
      }}
      onPointerOut={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        onHover(null);
      }}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(square.index);
      }}
      onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onFocus(square.index);
      }}
    >
      <meshStandardMaterial ref={material} map={texture} roughness={0.85} metalness={0} />
    </mesh>
  );
}
