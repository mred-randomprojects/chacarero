import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape, ShapeGeometry, Vector2 } from "three";
import type { DeedId, Holding, TokenId } from "../game";
import { SQUARES, getDeed } from "../game";
import { BANK_DEEDS, BANK_MONEY, BANK_PLATE } from "./anchors";
import { billTexture } from "./billTextures";
import { Buildings } from "./Buildings";
import type { PlateInfo } from "./cardTextures";
import type { HexLayout, Vec2 } from "./hexLayout";
import { computeHexLayout, hexagonVertices } from "./hexLayout";
import { Pawn } from "./Pawn";
import { PlayerArea } from "./PlayerArea";
import { seatFrame } from "./seats";
import { Tile } from "./Tile";
import { createBankTexture, createSlotTexture, createTitleTexture } from "./tileTexture";

export const BOARD_LAYOUT: HexLayout = computeHexLayout({ innerRadius: 10, tileDepth: 2.4, cornerExtension: 0.9 });

const SLAB_DEPTH = 0.5;
const SLAB_BEVEL = 0.08;
export const SLAB_MARGIN = 0.45;
export const TABLE_Y = -(SLAB_DEPTH + SLAB_BEVEL);
export const TABLE_RADIUS = 23;
const FELT_Y = 0.01;
const TILE_Y = 0.02;
const DECOR_Y = 0.03;
const PAWN_Y = TILE_Y;

/** Upright mesh rotation that lays a Shape drawn in board coordinates flat on the XZ plane. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export interface PawnView {
  readonly id: string;
  readonly token: TokenId;
  readonly color: string;
  readonly position: number;
  readonly route: readonly number[] | null;
  readonly routeId: number;
  readonly jump: boolean;
  readonly dimmed: boolean;
}

export interface SeatView {
  readonly playerId: string;
  readonly side: number;
  readonly plate: PlateInfo;
}

export interface BoardProps {
  readonly hovered: number | null;
  readonly selected: number | null;
  /** Squares the pawn on turn is about to visit, in order (the last is the destination). */
  readonly path: readonly number[];
  readonly onHover: (index: number | null) => void;
  readonly onSelect: (index: number) => void;
  /** Double-click on a square or a card: fly the camera there. */
  readonly onFocus: (index: number) => void;
  readonly pawns: readonly PawnView[];
  readonly seats: readonly SeatView[];
  readonly holdings: Readonly<Partial<Record<DeedId, Holding>>>;
  readonly colorOf: (playerId: string) => string;
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
export function Board({ hovered, selected, path, onHover, onSelect, onFocus, pawns, seats, holdings, colorOf, onPawnArrive }: BoardProps) {
  const layout = BOARD_LAYOUT;
  const pathSteps = useMemo(() => new Map(path.map((square, i) => [square, i + 1])), [path]);

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
  const bankTexture = useMemo(() => createBankTexture(), []);

  useEffect(
    () => () => {
      slabGeometry.dispose();
      feltGeometry.dispose();
      titleTexture.dispose();
      suerteTexture.dispose();
      destinoTexture.dispose();
      bankTexture.dispose();
    },
    [slabGeometry, feltGeometry, titleTexture, suerteTexture, destinoTexture, bankTexture],
  );

  return (
    <group>
      <mesh rotation={FLAT} position={[0, TABLE_Y - 0.01, 0]} receiveShadow>
        <circleGeometry args={[TABLE_RADIUS, 96]} />
        <meshStandardMaterial color="#2f6b3c" roughness={1} />
      </mesh>
      <mesh position={[0, TABLE_Y - 0.36, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS + 0.6, TABLE_RADIUS + 0.6, 0.6, 96]} />
        <meshStandardMaterial color="#4a3320" roughness={0.75} />
      </mesh>

      {seats.map((seat) => (
        <PlayerArea
          key={seat.playerId}
          playerId={seat.playerId}
          frame={seatFrame(layout, SLAB_MARGIN, seat.side)}
          plate={seat.plate}
          holdings={holdings}
          y={TABLE_Y + 0.01}
          onHover={onHover}
          onSelect={onSelect}
          onFocus={onFocus}
        />
      ))}

      <mesh geometry={slabGeometry} rotation={FLAT} position={[0, TABLE_Y, 0]} receiveShadow castShadow>
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

      {/* The bank: a plate, a pile of bills and the deed pile, where flights start and end. */}
      <mesh rotation={FLAT} position={[BANK_PLATE.x, DECOR_Y, -BANK_PLATE.y]}>
        <planeGeometry args={[3, 1]} />
        <meshStandardMaterial map={bankTexture} roughness={1} />
      </mesh>
      {[5000, 1000, 100].map((value, i) => (
        <mesh key={value} rotation={[-Math.PI / 2, 0, (i - 1) * 0.12]} position={[BANK_MONEY.x + (i - 1) * 0.3, DECOR_Y + 0.012 * (i + 1), -BANK_MONEY.y + (i - 1) * 0.2]} castShadow>
          <planeGeometry args={[0.68, 0.34]} />
          <meshStandardMaterial map={billTexture(value as 5000 | 1000 | 100)} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[BANK_DEEDS.x, DECOR_Y + 0.04, -BANK_DEEDS.y]} castShadow>
        <boxGeometry args={[1.15, 0.08, 1.63]} />
        <meshStandardMaterial color="#e9e2cf" roughness={1} />
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
            pathStep={pathSteps.get(tile.index) ?? null}
            pathLength={path.length}
            onHover={onHover}
            onSelect={onSelect}
            onFocus={onFocus}
          />
        );
      })}

      <Buildings layout={layout} holdings={holdings} colorOf={colorOf} y={TILE_Y} />

      {pawns.map((pawn, slot) => (
        <Pawn
          key={pawn.id}
          layout={layout}
          position={pawn.position}
          route={pawn.route}
          routeId={pawn.routeId}
          jump={pawn.jump}
          token={pawn.token}
          color={pawn.color}
          slot={slot}
          y={PAWN_Y}
          knockId={pawn.id}
          dimmed={pawn.dimmed}
          onArrive={(square) => onPawnArrive(pawn.id, square)}
        />
      ))}
    </group>
  );
}
