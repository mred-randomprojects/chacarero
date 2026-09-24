import { CanvasTexture, SRGBColorSpace } from "three";
import type { Card, Deed, Holding } from "../game";
import { PROVINCE_COLORS, PROVINCE_NAMES, ZONE_NAMES, deedText, pesos } from "../game";
import { TILE_FONT } from "./tileTexture";

const CARD_W = 240;
const CARD_H = 340;
const PLATE_W = 640;
const PLATE_H = 200;

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");
  return [element, ctx];
}

function texture(element: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(element);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function fit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number, weight: number, color: string): void {
  let current = size;
  ctx.font = `${weight} ${Math.round(current)}px ${TILE_FONT}`;
  while (ctx.measureText(text).width > maxWidth && current > 8) {
    current *= 0.92;
    ctx.font = `${weight} ${Math.round(current)}px ${TILE_FONT}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

const cardCache = new Map<string, CanvasTexture>();

export function bandColor(deed: Deed): string {
  return deed.kind === "campo" ? PROVINCE_COLORS[deed.province] : deed.kind === "ferrocarril" ? "#2b2b2b" : "#7a5230";
}

/**
 * A deed card as it lies on the table: colour band, name, price, rent ladder,
 * plus the current buildings and a "HIPOTECADA" stamp. Cached per state.
 */
export function deedCardTexture(deed: Deed, holding: Holding, scale = 1): CanvasTexture {
  const key = `${deed.id}|${holding.chacras}|${holding.estancia ? 1 : 0}|${holding.mortgaged ? 1 : 0}|${scale}`;
  const cached = cardCache.get(key);
  if (cached) return cached;

  // Drawn at the base size in a scaled context, so a close-up card stays crisp.
  const [element, ctx] = canvas(CARD_W * scale, CARD_H * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f7f2e4";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = bandColor(deed);
  ctx.fillRect(0, 0, CARD_W, 62);

  if (deed.kind === "campo") {
    fit(ctx, PROVINCE_NAMES[deed.province].toUpperCase(), CARD_W / 2, 26, 30, CARD_W - 20, 800, "#ffffff");
    fit(ctx, ZONE_NAMES[deed.zone].toUpperCase(), CARD_W / 2, 50, 16, CARD_W - 20, 600, "#ffffff");
  } else {
    const label = deed.kind === "ferrocarril" ? "FERROCARRIL" : "COMPAÑÍA";
    const name = deed.name.replace(/^Ferrocarril General /, "").replace(/^Compañía /, "").replace("Bartolomé ", "B. ");
    fit(ctx, label, CARD_W / 2, 22, 16, CARD_W - 20, 600, "#ffffff");
    fit(ctx, name.toUpperCase(), CARD_W / 2, 46, 26, CARD_W - 20, 800, "#ffffff");
  }

  fit(ctx, pesos(deed.price), CARD_W / 2, 92, 34, CARD_W - 20, 800, "#1a5fb4");

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `500 17px ${TILE_FONT}`;
  ctx.fillStyle = "#3a3631";
  const rows: [string, string][] =
    deed.kind === "campo"
      ? [
          ["Campo", pesos(deed.rent.campo)],
          ["1 chacra", pesos(deed.rent.chacras[0])],
          ["2 chacras", pesos(deed.rent.chacras[1])],
          ["3 chacras", pesos(deed.rent.chacras[2])],
          ["4 chacras", pesos(deed.rent.chacras[3])],
          ["Estancia", pesos(deed.rent.estancia)],
          ["Chacra", pesos(deed.chacraCost)],
        ]
      : deed.kind === "ferrocarril"
        ? deed.rentByCount.map((rent, i): [string, string] => [`${i + 1} FF.CC.`, pesos(rent)])
        : deed.diceMultiplierByCount.map((mult, i): [string, string] => [`${i + 1} cía.`, `dados × ${mult}`]);
  let y = 126;
  for (const [label, value] of rows) {
    ctx.textAlign = "left";
    ctx.fillText(label, 16, y);
    ctx.textAlign = "right";
    ctx.fillText(value, CARD_W - 16, y);
    y += 22;
  }

  // Railways and companies explain their rent in words, as the physical card does.
  const explanation = deedText(deed);
  if (explanation) {
    ctx.font = `500 13px ${TILE_FONT}`;
    ctx.fillStyle = "#3a3631";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    y += 8;
    for (const line of wrap(ctx, explanation, CARD_W - 32)) {
      ctx.fillText(line, 16, y);
      y += 16;
    }
    ctx.textBaseline = "middle";
  }

  // Buildings strip along the bottom.
  if (holding.estancia) {
    ctx.fillStyle = "#f2c21c";
    ctx.fillRect(CARD_W / 2 - 24, CARD_H - 40, 48, 26);
    fit(ctx, "ESTANCIA", CARD_W / 2, CARD_H - 27, 14, 46, 800, "#1d1a17");
  } else {
    for (let i = 0; i < holding.chacras; i++) {
      ctx.fillStyle = "#5cc8f2";
      ctx.fillRect(CARD_W / 2 - 52 + i * 28, CARD_H - 38, 22, 22);
    }
  }

  if (holding.mortgaged) {
    ctx.fillStyle = "rgba(60, 60, 60, 0.55)";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.save();
    ctx.translate(CARD_W / 2, CARD_H / 2);
    ctx.rotate(-Math.PI / 8);
    ctx.strokeStyle = "#c8261f";
    ctx.lineWidth = 6;
    ctx.strokeRect(-100, -26, 200, 52);
    fit(ctx, "HIPOTECADA", 0, 0, 34, 190, 800, "#c8261f");
    ctx.restore();
  }

  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, CARD_W, CARD_H);

  const tex = texture(element);
  cardCache.set(key, tex);
  return tex;
}

const dataUrlCache = new Map<string, string>();

/**
 * The same deed card as an image for the HTML side (the trade screen, the
 * prompts), so a card looks the same in the hand as on the table.
 */
export function deedCardDataUrl(deed: Deed, holding: Holding, scale = 2): string {
  const key = `${deed.id}|${holding.chacras}|${holding.estancia ? 1 : 0}|${holding.mortgaged ? 1 : 0}|${scale}`;
  const cached = dataUrlCache.get(key);
  if (cached) return cached;
  const image = deedCardTexture(deed, holding, scale).image as HTMLCanvasElement;
  const url = image.toDataURL("image/png");
  dataUrlCache.set(key, url);
  return url;
}

export interface PlateInfo {
  readonly name: string;
  readonly color: string;
  readonly cash: number;
  readonly inJail: boolean;
  readonly jailCards: number;
  readonly bankrupt: boolean;
  /** Voted out: shown as out, not broke. */
  readonly expelled: boolean;
  readonly isCurrent: boolean;
}

/** Name plate with the player's cash, redrawn whenever any field changes. */
export function namePlateTexture(info: PlateInfo): CanvasTexture {
  const [element, ctx] = canvas(PLATE_W, PLATE_H);
  ctx.fillStyle = info.isCurrent ? "#fff6d5" : "#f7f2e4";
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);
  ctx.fillStyle = info.color;
  ctx.fillRect(0, 0, 28, PLATE_H);
  fit(ctx, info.name, PLATE_W / 2 + 14, 50, 54, PLATE_W - 80, 800, info.bankrupt ? "#8a847a" : "#1d1a17");
  const cash = info.expelled ? "AFUERA" : info.bankrupt ? "QUEBRÓ" : pesos(info.cash);
  fit(ctx, cash, PLATE_W / 2 + 14, 120, 66, PLATE_W - 80, 800, info.bankrupt ? "#c8261f" : "#1f5e2e");
  const status = [info.inJail ? "PRESO" : "", info.jailCards > 0 ? `${info.jailCards} tarjeta${info.jailCards > 1 ? "s" : ""} de salida` : ""]
    .filter(Boolean)
    .join(" · ");
  if (status) fit(ctx, status, PLATE_W / 2 + 14, 172, 24, PLATE_W - 80, 600, "#c8261f");
  ctx.strokeStyle = info.isCurrent ? "#f2c21c" : "#2a2622";
  ctx.lineWidth = info.isCurrent ? 12 : 4;
  ctx.strokeRect(0, 0, PLATE_W, PLATE_H);
  return texture(element);
}

const chanceCache = new Map<string, CanvasTexture>();

/** Word-wraps `text` into lines that fit `maxWidth` at the current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A Suerte/Destino card, face up: deck header and the full text. */
export function chanceCardTexture(card: Card): CanvasTexture {
  const cached = chanceCache.get(card.id);
  if (cached) return cached;
  const w = 480;
  const h = 300;
  const [element, ctx] = canvas(w, h);
  const suerte = card.deck === "suerte";
  ctx.fillStyle = "#f7f2e4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = suerte ? "#e8891c" : "#1f7a3a";
  ctx.fillRect(0, 0, w, 64);
  fit(ctx, suerte ? "SUERTE" : "DESTINO", w / 2, 33, 38, w - 40, 800, "#ffffff");
  ctx.fillStyle = "#1d1a17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 30;
  let lines: string[];
  do {
    ctx.font = `600 ${size}px ${TILE_FONT}`;
    lines = wrap(ctx, card.text, w - 60);
    size -= 2;
  } while (lines.length * (size + 8) > h - 100 && size > 14);
  const lineHeight = size + 10;
  let y = 64 + (h - 64 - lines.length * lineHeight) / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += lineHeight;
  }
  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, w, h);
  const tex = texture(element);
  chanceCache.set(card.id, tex);
  return tex;
}

/** The face-down back of a Suerte/Destino card. */
export function chanceBackTexture(deck: "suerte" | "destino"): CanvasTexture {
  const key = `back-${deck}`;
  const cached = chanceCache.get(key);
  if (cached) return cached;
  const w = 480;
  const h = 300;
  const [element, ctx] = canvas(w, h);
  ctx.fillStyle = deck === "suerte" ? "#e8891c" : "#1f7a3a";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#f7f2e4";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  fit(ctx, deck === "suerte" ? "!" : "?", w / 2, h / 2 - 20, 150, w, 800, "#f7f2e4");
  fit(ctx, deck === "suerte" ? "SUERTE" : "DESTINO", w / 2, h - 50, 44, w - 40, 800, "#f7f2e4");
  const tex = texture(element);
  chanceCache.set(key, tex);
  return tex;
}
