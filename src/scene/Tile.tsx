import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
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
  readonly onHover: (index: number | null) => void;
  readonly onSelect: (index: number) => void;
}

/**
 * One square of the ring: a flat polygon with its face drawn on a canvas.
 * Hover/selection are shown by tinting the material's emissive channel.
 */
export function Tile({ tile, square, deed, y, hovered, selected, onHover, onSelect }: TileProps) {
  const geometry = useMemo(() => createTileGeometry(tile, y), [tile, y]);
  const texture = useMemo(() => createTileTexture(tile, square, deed), [tile, square, deed]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  const emissive = selected ? "#ffd166" : hovered ? "#ffffff" : "#000000";
  const emissiveIntensity = selected ? 0.35 : hovered ? 0.18 : 0;

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
    >
      <meshStandardMaterial map={texture} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} metalness={0} />
    </mesh>
  );
}
