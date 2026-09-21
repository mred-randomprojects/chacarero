import { useState } from "react";
import type { GameState, Square } from "../game";
import { DEEDS, SQUARES, deedName, deedsOwnedBy, getDeed, getToken, pesos } from "../game";
import { bandColor } from "../scene/cardTextures";
import type { TileLayout, Vec2 } from "../scene/hexLayout";
import { pawnPosition } from "../scene/hexLayout";
import { BOARD_LAYOUT } from "../scene/Board";
import { PAWN_SPACING_RATIO } from "../scene/pawnSpots";
import type { Dispatch } from "./ActionBar";
import { PropertiesTable } from "./PropertiesList";
import { TokenIcon } from "./TokenIcon";

export interface BoardMapProps {
  readonly state: GameState;
  readonly onClose: () => void;
  /** A square was clicked: select it (its panel opens) and close the map. */
  readonly onSelect: (squareIndex: number) => void;
  readonly dispatch: Dispatch;
  readonly you: string | null;
  readonly busy: boolean;
}

type Tab = "map" | "list";

const CREAM = "#f7f2e4";
const CORNER = "#dfe8d3";
const INK = "#1d1a17";
const MORTGAGE = "#8a847a";

/** Board coordinates → SVG (y down). */
function pt(p: Vec2): string {
  return `${p.x.toFixed(3)},${(-p.y).toFixed(3)}`;
}

function polygonPoints(points: readonly Vec2[]): string {
  return points.map(pt).join(" ");
}

/** Board-space point `right`/`up` from a tile's centre in its own frame. */
function local(tile: TileLayout, right: number, up: number): Vec2 {
  return { x: tile.center.x + tile.right.x * right + tile.up.x * up, y: tile.center.y + tile.right.y * right + tile.up.y * up };
}

/** A strip across the tile between local `up` values `from` and `to` (full width, slightly inset). */
function strip(tile: TileLayout, from: number, to: number, inset = 0.06): string {
  const { min, max } = tile.localBounds;
  const left = min.x + inset;
  const right = max.x - inset;
  return polygonPoints([local(tile, left, from), local(tile, right, from), local(tile, right, to), local(tile, left, to)]);
}

function bandColorOf(square: Square): string | null {
  if (square.kind !== "campo" && square.kind !== "ferrocarril" && square.kind !== "compania") return null;
  return bandColor(getDeed(square.deedId));
}

/** Text angle so a tile's number reads upright-ish from outside the ring: rotate with the tile's "right" vector. */
function textAngle(tile: TileLayout): number {
  const angle = (Math.atan2(-tile.right.y, tile.right.x) * 180) / Math.PI;
  // Keep text from ending up upside down.
  return angle > 90 || angle < -90 ? angle + 180 : angle;
}

/**
 * A flat map of the ring: every square with its colour band, the owner's
 * strip (grey and hatched when mortgaged), buildings, and a pin per player
 * on the square they stand on. Click a square to open its panel.
 */
function HexMap({ state, onSelect }: { readonly state: GameState; readonly onSelect: (index: number) => void }) {
  const layout = BOARD_LAYOUT;
  const spacing = layout.tileWidth * PAWN_SPACING_RATIO;
  const radius = layout.outerRadius + 1.2;
  const colorOf = (id: string) => state.players.find((p) => p.id === id)?.color ?? INK;
  const pins = state.players.filter((p) => !p.bankrupt);

  return (
    <svg className="hex-map" viewBox={`${-radius} ${-radius} ${radius * 2} ${radius * 2}`} role="img" aria-label="Mapa del tablero">
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="0.3" height="0.3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.3" stroke={MORTGAGE} strokeWidth="0.12" />
        </pattern>
      </defs>
      <polygon points={polygonPoints(layout.innerHexagon)} fill="#b3261e" opacity="0.9" />
      {layout.tiles.map((tile) => {
        const square = SQUARES[tile.index];
        if (!square) return null;
        const deed = square.kind === "campo" || square.kind === "ferrocarril" || square.kind === "compania" ? getDeed(square.deedId) : null;
        const holding = deed ? state.holdings[deed.id] : undefined;
        const band = bandColorOf(square);
        const { min, max } = tile.localBounds;
        const depth = max.y - min.y;
        const owner = holding ? state.players.find((p) => p.id === holding.ownerId) : undefined;
        const labelAt = local(tile, 0, tile.isCorner ? 0 : min.y + depth * 0.42);
        return (
          <g key={tile.index} className="map-tile" onClick={() => onSelect(tile.index)}>
            <title>
              {square.index}. {square.name}
              {deed ? ` · ${pesos(deed.price)}` : ""}
              {owner ? ` · ${owner.name}${holding?.mortgaged ? " (hipotecada)" : ""}` : deed ? " · libre" : ""}
            </title>
            <polygon points={polygonPoints(tile.polygon)} fill={tile.isCorner ? CORNER : CREAM} stroke={INK} strokeWidth="0.06" />
            {band && <polygon points={strip(tile, max.y - depth * 0.22, max.y, 0.04)} fill={band} />}
            {holding && (
              <polygon points={strip(tile, min.y + 0.05, min.y + depth * 0.14)} fill={holding.mortgaged ? "url(#hatch)" : colorOf(holding.ownerId)} stroke={holding.mortgaged ? MORTGAGE : "none"} strokeWidth="0.03" />
            )}
            {holding && deed?.kind === "campo" && holding.estancia && (
              <polygon points={strip(tile, max.y - depth * 0.2, max.y - depth * 0.04, (max.x - min.x) * 0.3)} fill="#f2c21c" stroke={INK} strokeWidth="0.03" />
            )}
            {holding &&
              deed?.kind === "campo" &&
              !holding.estancia &&
              Array.from({ length: holding.chacras }, (_, i) => {
                const offset = (i - (holding.chacras - 1) / 2) * 0.3;
                const c = local(tile, offset, max.y - depth * 0.12);
                return <rect key={i} x={c.x - 0.11} y={-c.y - 0.11} width="0.22" height="0.22" fill="#5cc8f2" stroke={INK} strokeWidth="0.03" />;
              })}
            <text x={labelAt.x} y={-labelAt.y} transform={`rotate(${textAngle(tile)} ${labelAt.x} ${-labelAt.y})`} fontSize={tile.isCorner ? 0.9 : 0.62} fontWeight="800" fill={INK} textAnchor="middle" dominantBaseline="middle">
              {square.index}
            </text>
          </g>
        );
      })}
      {pins.map((player, slot) => {
        const tile = layout.tiles[player.position];
        if (!tile) return null;
        const p = pawnPosition(tile, slot, spacing);
        const token = getToken(player.token);
        return (
          <g key={player.id} className="map-pin" transform={`translate(${p.x} ${-p.y})`}>
            <title>{player.name}</title>
            <path d="M0,0 L-0.45,-0.75 A0.55,0.55 0 1,1 0.45,-0.75 Z" fill={player.color} stroke="#fff" strokeWidth="0.08" />
            <text y="-0.98" fontSize="0.62" textAnchor="middle" dominantBaseline="middle">
              {token.icon}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The numbers beside the map: what is free, what each player holds, what the bank has left. */
function MapStats({ state }: { readonly state: GameState }) {
  const free = DEEDS.filter((d) => !state.holdings[d.id]);
  const rows = state.players.map((player) => {
    const deeds = deedsOwnedBy(state, player.id);
    let chacras = 0;
    let estancias = 0;
    let mortgaged = 0;
    let value = 0;
    for (const id of deeds) {
      const holding = state.holdings[id];
      if (!holding) continue;
      value += getDeed(id).price;
      if (holding.estancia) estancias += 1;
      else chacras += holding.chacras;
      if (holding.mortgaged) mortgaged += 1;
    }
    return { player, deeds: deeds.length, chacras, estancias, mortgaged, value };
  });
  return (
    <div className="map-stats">
      <section>
        <h3>Libres</h3>
        <p>
          <strong>{free.length}</strong> de {DEEDS.length} escrituras siguen en el Banco
          {free.length > 0 && free.length <= 6 ? `: ${free.map((d) => deedName(d)).join(", ")}.` : "."}
        </p>
      </section>
      <section>
        <h3>Jugadores</h3>
        <ul>
          {rows.map(({ player, deeds, chacras, estancias, mortgaged, value }) => (
            <li key={player.id} className={player.bankrupt ? "bankrupt" : ""}>
              <TokenIcon token={player.token} size={20} />
              <span className="name">{player.name}</span>
              <span className="detail">
                {player.bankrupt ? "quebró" : `${deeds} escr. (${pesos(value)}) · ${chacras} chacras · ${estancias} est.${mortgaged ? ` · ${mortgaged} hip.` : ""}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Banco</h3>
        <p>
          {state.bank.chacras} chacras y {state.bank.estancias} estancias por vender · Suerte {state.decks.suerte.length} · Destino {state.decks.destino.length}
        </p>
      </section>
    </div>
  );
}

/** The board at a glance: a 2D map with a list view on the second tab. `L` opens it. */
export function BoardMap({ state, onClose, onSelect, dispatch, you, busy }: BoardMapProps) {
  const [tab, setTab] = useState<Tab>("map");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal board-map" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Tablero</h2>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "map"} className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
              Mapa
            </button>
            <button type="button" role="tab" aria-selected={tab === "list"} className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
              Lista
            </button>
          </div>
          <button type="button" className="close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal-body">
          {tab === "map" ? (
            <div className="map-layout">
              <HexMap state={state} onSelect={onSelect} />
              <MapStats state={state} />
            </div>
          ) : (
            <PropertiesTable state={state} onSelect={onSelect} dispatch={dispatch} you={you} busy={busy} />
          )}
        </div>
      </div>
    </div>
  );
}
