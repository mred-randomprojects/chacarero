import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape, ShapeGeometry, Vector2 } from "three";
import { SQUARES, getDeed } from "../game";
import type { HexLayout, Vec2 } from "./hexLayout";
import { computeHexLayout, hexagonVertices } from "./hexLayout";
import { Pawn } from "./Pawn";
import { Tile } from "./Tile";
import { createSlotTexture, createTitleTexture } from "./tileTexture";

export const BOARD_LAYOUT: HexLayout = computeHexLayout({ innerRadius: 10, tileDepth: 2.4, cornerExtension: 0.9 });

const SLAB_DEPTH = 0.5;
const SLAB_BEVEL = 0.08;
const SLAB_MARGIN = 0.45;
const FELT_Y = 0.01;
const TILE_Y = 0.02;
const DECOR_Y = 0.03;
const PAWN_Y = TILE_Y;

/** Upright mesh rotation that lays a Shape drawn in board coordinates flat on the XZ plane. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export interface PawnState {
  readonly id: string;
  readonly color: string;
  readonly steps: number;
}

export interface BoardProps {
  readonly hovered: number | null;
  readonly selected: number | null;
  readonly onHover: (index: number | null) => void;
  readonly onSelect: (index: number) => void;
  readonly pawns: readonly PawnState[];
  readonly onPawnArrive: (pawnId: string, square: number) => void;
}

function toShape(points: readonly Vec2[]): Shape {
  return new Shape(points.map((p) => new Vector2(p.x, p.y)));
}

/**
 * The whole table: a bevelled slab, the felt centre with the title and card
 * slots, the 42 tiles and the pawns. Board coordinates map to XZ with +y (board)
 * towards -z (world), so Salida ends up at the bottom-right from the default camera.
 */
export function Board({ hovered, selected, onHover, onSelect, pawns, onPawnArrive }: BoardProps) {
  const layout = BOARD_LAYOUT;

  const slabGeometry = useMemo(() => {
    const shape = toShape(hexagonVertices(layout.outerRadius + SLAB_MARGIN));
    return new ExtrudeGeometry(shape, {
      depth: SLAB_DEPTH,
      bevelEnabled: true,
      bevelThickness: SLAB_BEVEL,
      bevelSize: SLAB_BEVEL,
      bevelSegments: 3,
    });
  }, [layout]);
  const feltGeometry = useMemo(() => new ShapeGeometry(toShape(layout.innerHexagon)), [layout]);
  const titleTexture = useMemo(() => createTitleTexture(14, 4.4), []);
  const suerteTexture = useMemo(() => createSlotTexture("SUERTE", "!", "#e8891c"), []);
  const destinoTexture = useMemo(() => createSlotTexture("DESTINO", "?", "#1f7a3a"), []);

  useEffect(
    () => () => {
      slabGeometry.dispose();
      feltGeometry.dispose();
      titleTexture.dispose();
      suerteTexture.dispose();
      destinoTexture.dispose();
    },
    [slabGeometry, feltGeometry, titleTexture, suerteTexture, destinoTexture],
  );

  return (
    <group>
      <mesh geometry={slabGeometry} rotation={FLAT} position={[0, -(SLAB_DEPTH + SLAB_BEVEL), 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#3b2a1e" roughness={0.7} metalness={0.05} />
      </mesh>

      <mesh geometry={feltGeometry} rotation={FLAT} position={[0, FELT_Y, 0]} receiveShadow>
        <meshStandardMaterial color="#b3261e" roughness={1} />
      </mesh>

      <mesh rotation={FLAT} position={[0, DECOR_Y, 0]}>
        <planeGeometry args={[14, 4.4]} />
        <meshStandardMaterial map={titleTexture} transparent roughness={1} />
      </mesh>
      <mesh rotation={FLAT} position={[-4.6, DECOR_Y, -4.2]}>
        <planeGeometry args={[3.2, 2]} />
        <meshStandardMaterial map={suerteTexture} roughness={1} />
      </mesh>
      <mesh rotation={FLAT} position={[4.6, DECOR_Y, 4.2]}>
        <planeGeometry args={[3.2, 2]} />
        <meshStandardMaterial map={destinoTexture} roughness={1} />
      </mesh>

      {layout.tiles.map((tile) => {
        const square = SQUARES[tile.index];
        if (!square) return null;
        const deed = square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania" ? getDeed(square.deedId) : undefined;
        return (
          <Tile
            key={tile.index}
            tile={tile}
            square={square}
            deed={deed}
            y={TILE_Y}
            hovered={hovered === tile.index}
            selected={selected === tile.index}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}

      {pawns.map((pawn, slot) => (
        <Pawn
          key={pawn.id}
          layout={layout}
          steps={pawn.steps}
          color={pawn.color}
          slot={slot}
          y={PAWN_Y}
          onArrive={(square) => onPawnArrive(pawn.id, square)}
        />
      ))}
    </group>
  );
}
