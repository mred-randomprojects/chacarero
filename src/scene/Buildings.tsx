import type { ReactNode } from "react";
import type { DeedId, Holding } from "../game";
import { DEEDS } from "../game";
import { layoutIndexFor, local, yaw } from "./buildingSpots";
import type { HexLayout } from "./hexLayout";
import { boardToWorld } from "./tileGeometry";

export interface BuildingsProps {
  readonly layout: HexLayout;
  readonly holdings: Readonly<Partial<Record<DeedId, Holding>>>;
  readonly colorOf: (playerId: string) => string;
  readonly y: number;
}

const CHACRA_COLOR = "#5cc8f2";
const ESTANCIA_COLOR = "#f2c21c";
const MORTGAGE_COLOR = "#6b6b6b";

/**
 * Ownership strips and buildings on top of the tiles: a bar in the owner's
 * colour along the outer edge (grey when mortgaged), little chacras in the
 * colour band, and a larger estancia in their place.
 */
export function Buildings({ layout, holdings, colorOf, y }: BuildingsProps) {
  const items: ReactNode[] = [];
  for (const deed of DEEDS) {
    const holding = holdings[deed.id];
    if (!holding) continue;
    const squareIndex = layoutIndexFor(deed.id);
    const tile = layout.tiles[squareIndex];
    if (!tile) continue;
    const width = tile.localBounds.max.x - tile.localBounds.min.x;
    const depth = tile.localBounds.max.y - tile.localBounds.min.y;
    const rotation: [number, number, number] = [0, yaw(tile), 0];

    const strip = local(tile, 0, tile.localBounds.min.y + 0.09);
    items.push(
      <mesh key={`${deed.id}-owner`} position={boardToWorld(strip, y + 0.03)} rotation={rotation} castShadow>
        <boxGeometry args={[width * 0.9, 0.06, 0.14]} />
        <meshStandardMaterial color={holding.mortgaged ? MORTGAGE_COLOR : colorOf(holding.ownerId)} roughness={0.5} />
      </mesh>,
    );

    if (deed.kind !== "campo") continue;
    const bandY = tile.localBounds.max.y - depth * 0.1;
    if (holding.estancia) {
      const p = local(tile, 0, bandY);
      items.push(
        <mesh key={`${deed.id}-estancia`} position={boardToWorld(p, y + 0.16)} rotation={rotation} castShadow>
          <boxGeometry args={[0.5, 0.32, 0.34]} />
          <meshStandardMaterial color={ESTANCIA_COLOR} roughness={0.5} />
        </mesh>,
      );
      continue;
    }
    for (let i = 0; i < holding.chacras; i++) {
      const offset = (i - (holding.chacras - 1) / 2) * 0.3;
      const p = local(tile, offset, bandY);
      items.push(
        <mesh key={`${deed.id}-chacra-${i}`} position={boardToWorld(p, y + 0.1)} rotation={rotation} castShadow>
          <boxGeometry args={[0.22, 0.2, 0.22]} />
          <meshStandardMaterial color={CHACRA_COLOR} roughness={0.5} />
        </mesh>,
      );
    }
  }
  return <group>{items}</group>;
}
