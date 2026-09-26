import { CanvasTexture, SRGBColorSpace } from "three";
import type { Deck, Deed, Square } from "../game";
import { PROVINCE_COLORS, PROVINCE_NAMES, TRANQUERA_BONUS, pesos } from "../game";
import { DECK_ART, drawDeckSymbol } from "./deckArt";
import type { TileLayout } from "./hexLayout";

/** Canvas pixels per board unit. Tiles are ~1.4 × 2.4 units, so this keeps text crisp. */
const PX_PER_UNIT = 160;

const CREAM = "#f7f2e4";
const INK = "#1d1a17";
const GREEN = "#1f5e2e";
const RED_BADGE = "#c8261f";
const PRICE_BLUE = "#1a5fb4";

export const TILE_FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";
export const TITLE_FONT = "'Lobster', 'Georgia', serif";

interface Frame {
  readonly ctx: CanvasRenderingContext2D;
  /** Tile bounding-box width/height in board units. */
  readonly w: number;
  readonly h: number;
  /** Local bounds; side tiles are symmetric, corner tiles are not. */
  readonly minY: number;
  readonly maxY: number;
  /** Converts local board coordinates (origin at tile centre, +y up) to canvas px. */
  readonly px: (x: number, y: number) => [number, number];
  readonly unit: (units: number) => number;
}

function font(frame: Frame, sizeUnits: number, weight = 700): string {
  return `${weight} ${Math.round(frame.unit(sizeUnits))}px ${TILE_FONT}`;
}

/** Draws centred text, shrinking the font until it fits `maxWidthUnits`. */
function fitText(frame: Frame, text: string, x: number, y: number, size: number, maxWidthUnits: number, weight = 700, color = INK): void {
  const { ctx } = frame;
  let current = size;
  ctx.font = font(frame, current, weight);
  const maxPx = frame.unit(maxWidthUnits);
  while (ctx.measureText(text).width > maxPx && current > 0.05) {
    current *= 0.92;
    ctx.font = font(frame, current, weight);
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const [cx, cy] = frame.px(x, y);
  ctx.fillText(text, cx, cy);
}

function badge(frame: Frame, index: number, x: number, y: number, radiusUnits = 0.17): void {
  const { ctx } = frame;
  const [cx, cy] = frame.px(x, y);
  ctx.beginPath();
  ctx.arc(cx, cy, frame.unit(radiusUnits), 0, Math.PI * 2);
  ctx.fillStyle = RED_BADGE;
  ctx.fill();
  ctx.lineWidth = frame.unit(0.02);
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  fitText(frame, String(index), x, y + 0.01, radiusUnits * 1.25, radiusUnits * 1.7, 800, "#ffffff");
}

function fillRectUnits(frame: Frame, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const [ax, ay] = frame.px(Math.min(x0, x1), Math.max(y0, y1));
  const [bx, by] = frame.px(Math.max(x0, x1), Math.min(y0, y1));
  frame.ctx.fillStyle = color;
  frame.ctx.fillRect(ax, ay, bx - ax, by - ay);
}

function drawCampo(frame: Frame, square: Square, deed: Deed): void {
  if (deed.kind !== "campo") return;
  const { w, h, minY, maxY } = frame;
  const bandHeight = h * 0.2;
  fillRectUnits(frame, -w / 2, maxY, w / 2, maxY - bandHeight, PROVINCE_COLORS[deed.province]);
  const top = maxY - bandHeight;
  fitText(frame, PROVINCE_NAMES[deed.province].toUpperCase(), 0, top - 0.17, 0.13, w * 0.85, 500, "#5a544c");
  drawCityName(frame, deed.city.toUpperCase(), top - 0.5, w);
  fitText(frame, `VALOR ${pesos(deed.price)}`, 0, top - 0.95, 0.16, w * 0.9, 700, PRICE_BLUE);
  badge(frame, square.index, 0, minY + 0.3);
}

/**
 * The city in big letters. Long names ("VILLA GENERAL BELGRANO") wrap onto two
 * lines instead of shrinking to nothing.
 */
function drawCityName(frame: Frame, city: string, y: number, w: number): void {
  const words = city.split(" ");
  if (words.length < 3) {
    fitText(frame, city, 0, y, 0.24, w * 0.9, 800);
    return;
  }
  const half = Math.ceil(words.length / 2);
  fitText(frame, words.slice(0, half).join(" "), 0, y + 0.13, 0.2, w * 0.9, 800);
  fitText(frame, words.slice(half).join(" "), 0, y - 0.13, 0.2, w * 0.9, 800);
}

/** The dashed centre line of a road across the route band. */
function drawRoadIcon(frame: Frame, y: number, width: number): void {
  const { ctx } = frame;
  ctx.strokeStyle = "#f2d21c";
  ctx.lineWidth = frame.unit(0.05);
  ctx.setLineDash([frame.unit(0.12), frame.unit(0.08)]);
  const [x0, yMid] = frame.px(-width / 2, y);
  const [x1] = frame.px(width / 2, y);
  ctx.beginPath();
  ctx.moveTo(x0, yMid);
  ctx.lineTo(x1, yMid);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRuta(frame: Frame, square: Square, deed: Deed): void {
  if (deed.kind !== "ruta") return;
  const { w, h, minY, maxY } = frame;
  fillRectUnits(frame, -w / 2, maxY, w / 2, maxY - h * 0.2, "#2b2b2b");
  drawRoadIcon(frame, maxY - h * 0.1, w * 0.8);
  const top = maxY - h * 0.2;
  fitText(frame, "RUTA NACIONAL", 0, top - 0.17, 0.13, w * 0.85, 500, "#5a544c");
  fitText(frame, deed.name.replace(/^Ruta /, ""), 0, top - 0.52, 0.42, w * 0.9, 800);
  fitText(frame, `VALOR ${pesos(deed.price)}`, 0, top - 0.95, 0.16, w * 0.9, 700, PRICE_BLUE);
  badge(frame, square.index, 0, minY + 0.3);
}

function drawCompania(frame: Frame, square: Square, deed: Deed): void {
  if (deed.kind !== "compania") return;
  const { w, h, minY, maxY } = frame;
  fillRectUnits(frame, -w / 2, maxY, w / 2, maxY - h * 0.2, "#7a5230");
  const top = maxY - h * 0.2;
  fitText(frame, "COMPAÑÍA", 0, top - 0.17, 0.13, w * 0.85, 500, "#5a544c");
  fitText(frame, deed.name.toUpperCase(), 0, top - 0.45, 0.24, w * 0.9, 800);
  fitText(frame, `VALOR ${pesos(deed.price)}`, 0, top - 0.95, 0.16, w * 0.9, 700, PRICE_BLUE);
  badge(frame, square.index, 0, minY + 0.3);
}

function drawDeckTile(frame: Frame, square: Square, deck: Deck): void {
  const { w, minY, maxY } = frame;
  const art = DECK_ART[deck];
  fillRectUnits(frame, -w / 2, maxY, w / 2, minY, art.color);
  const [cx, cy] = frame.px(0, 0.3);
  drawDeckSymbol(frame.ctx, deck, cx, cy, frame.unit(Math.min(1.0, w * 0.8)));
  fitText(frame, art.label, 0, -0.45, 0.24, w * 0.9, 800, "#ffffff");
  badge(frame, square.index, 0, minY + 0.3);
}

function drawMoney(frame: Frame, square: Square, lines: readonly string[], amount: string, color: string): void {
  const { w, minY, maxY } = frame;
  let y = maxY - 0.4;
  for (const line of lines) {
    fitText(frame, line, 0, y, 0.19, w * 0.9, 800, INK);
    y -= 0.24;
  }
  fitText(frame, amount, 0, y - 0.12, 0.2, w * 0.9, 800, color);
  badge(frame, square.index, 0, minY + 0.3);
}

function cornerSubtitle(square: Square): string | null {
  switch (square.kind) {
    case "tranquera":
      return `AL PASAR COBRÁ ${pesos(TRANQUERA_BONUS)}`;
    case "premio":
      return `COBRÁ ${pesos(square.amount)}`;
    default:
      return null;
  }
}

function drawCorner(frame: Frame, square: Square): void {
  const { w, h, minY } = frame;
  fillRectUnits(frame, -w, h, w, -h, GREEN);
  const lines = square.name.toUpperCase().split(" ");
  const subtitle = cornerSubtitle(square);
  const size = 0.36;
  let y = ((lines.length - 1) * size * 1.05) / 2 + (subtitle ? 0.16 : 0.06);
  for (const line of lines) {
    fitText(frame, line, 0, y, size, 2.8, 800, "#ffffff");
    y -= size * 1.05;
  }
  if (subtitle) {
    fitText(frame, subtitle, 0, y + 0.02, 0.17, 2.4, 700, "#f2d21c");
  }
  badge(frame, square.index, 0, minY + 0.5, 0.2);
}

function drawTile(frame: Frame, tile: TileLayout, square: Square, deed: Deed | undefined): void {
  const { ctx } = frame;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (tile.isCorner) {
    drawCorner(frame, square);
    strokeOutline(frame, tile);
    return;
  }

  switch (square.kind) {
    case "campo":
      if (deed) drawCampo(frame, square, deed);
      break;
    case "ruta":
      if (deed) drawRuta(frame, square, deed);
      break;
    case "compania":
      if (deed) drawCompania(frame, square, deed);
      break;
    case "suerte":
    case "yeta":
      drawDeckTile(frame, square, square.kind);
      break;
    case "impuesto":
      drawMoney(frame, square, square.name.toUpperCase().split(" "), `PAGÁ ${pesos(square.amount)}`, RED_BADGE);
      break;
    case "premio":
      drawMoney(frame, square, square.name.toUpperCase().split(" "), `COBRÁ ${pesos(square.amount)}`, GREEN);
      break;
    case "tranquera":
    case "destacamento":
    case "siesta":
    case "mateada":
    case "enCana":
      // Always corners; handled above. Kept so the switch stays exhaustive.
      drawCorner(frame, square);
      break;
  }
  strokeOutline(frame, tile);
}

/** Outline so tiles read as separate cards. */
function strokeOutline(frame: Frame, tile: TileLayout): void {
  const { ctx } = frame;
  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = frame.unit(0.05);
  ctx.beginPath();
  tile.local.forEach((p, i) => {
    const [x, y] = frame.px(p.x, p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
}

/**
 * Renders a tile's face into a canvas texture. The canvas covers the tile's
 * local bounding box, so it pairs with `createTileGeometry`'s UVs.
 */
export function createTileTexture(tile: TileLayout, square: Square, deed: Deed | undefined): CanvasTexture {
  const { min, max } = tile.localBounds;
  const w = max.x - min.x;
  const h = max.y - min.y;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * PX_PER_UNIT);
  canvas.height = Math.ceil(h * PX_PER_UNIT);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");

  const frame: Frame = {
    ctx,
    w,
    h,
    minY: min.y,
    maxY: max.y,
    px: (x, y) => [(x - min.x) * PX_PER_UNIT, (max.y - y) * PX_PER_UNIT],
    unit: (units) => units * PX_PER_UNIT,
  };
  drawTile(frame, tile, square, deed);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Transparent canvas with the game title, for the felt in the middle of the board. */
export function createTitleTexture(widthUnits: number, heightUnits: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(widthUnits * PX_PER_UNIT);
  canvas.height = Math.ceil(heightUnits * PX_PER_UNIT);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(heightUnits * 0.55 * PX_PER_UNIT)}px ${TITLE_FONT}`;
  ctx.lineWidth = heightUnits * 0.03 * PX_PER_UNIT;
  ctx.strokeStyle = "#f7f2e4";
  ctx.lineJoin = "round";
  ctx.strokeText("Chacarero", canvas.width / 2, canvas.height * 0.42);
  ctx.fillStyle = "#c8261f";
  ctx.fillText("Chacarero", canvas.width / 2, canvas.height * 0.42);
  ctx.font = `600 ${Math.round(heightUnits * 0.11 * PX_PER_UNIT)}px ${TILE_FONT}`;
  ctx.fillStyle = "#f7f2e4";
  ctx.fillText("UN JUEGO DE CAMPO", canvas.width / 2, canvas.height * 0.8);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Card-deck slot texture on the felt: the deck's colour, symbol and name. */
export function createSlotTexture(deck: Deck): CanvasTexture {
  const { label, color: background } = DECK_ART[deck];
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#f7f2e4";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawDeckSymbol(ctx, deck, canvas.width / 2, 120, 170);
  ctx.fillStyle = "#f7f2e4";
  ctx.font = `800 72px ${TILE_FONT}`;
  ctx.fillText(label, canvas.width / 2, 245);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** "BANCO" plate for the middle of the felt. */
export function createBankTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");
  ctx.fillStyle = "#f7f2e4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1f5e2e";
  ctx.font = `800 84px ${TILE_FONT}`;
  ctx.fillText("BANCO", canvas.width / 2, 70);
  ctx.fillStyle = "#5a544c";
  ctx.font = `600 26px ${TILE_FONT}`;
  ctx.fillText("DE LA CHACRA", canvas.width / 2, 125);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
