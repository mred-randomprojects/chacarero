import { CanvasTexture, SRGBColorSpace } from "three";
import type { Denomination } from "../game";
import { pesos } from "../game";
import { TILE_FONT, TITLE_FONT } from "./tileTexture";

const BILL_W = 320;
const BILL_H = 160;

/** One colour per denomination, loosely following the old game's bills. */
export const BILL_COLORS: Readonly<Record<Denomination, string>> = {
  10: "#b9c4a8",
  50: "#8fb8de",
  100: "#e8d66b",
  200: "#f0a75a",
  500: "#e9a0b5",
  1000: "#8fcf9a",
  2000: "#b59ad6",
  5000: "#d98c7a",
};

const billCache = new Map<Denomination, CanvasTexture>();
const chipCache = new Map<number, CanvasTexture>();

function make(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");
  return [canvas, ctx];
}

/** A bank note: coloured field, ornamental border, the value big in the middle. */
export function billTexture(value: Denomination): CanvasTexture {
  const cached = billCache.get(value);
  if (cached) return cached;
  const [canvas, ctx] = make(BILL_W, BILL_H);
  ctx.fillStyle = BILL_COLORS[value];
  ctx.fillRect(0, 0, BILL_W, BILL_H);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, BILL_W - 16, BILL_H - 16);
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, BILL_W - 36, BILL_H - 36);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.font = `${Math.round(BILL_H * 0.14)}px ${TITLE_FONT}`;
  ctx.fillText("Chacarero", BILL_W / 2, 36);
  ctx.font = `800 ${Math.round(BILL_H * 0.42)}px ${TILE_FONT}`;
  ctx.fillText(pesos(value), BILL_W / 2, BILL_H / 2 + 8);
  ctx.font = `600 ${Math.round(BILL_H * 0.1)}px ${TILE_FONT}`;
  ctx.fillText("BANCO DE LA CHACRA", BILL_W / 2, BILL_H - 30);
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(BILL_H * 0.13)}px ${TILE_FONT}`;
  ctx.fillText(String(value), 26, 40);
  ctx.textAlign = "right";
  ctx.fillText(String(value), BILL_W - 26, BILL_H - 40);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  billCache.set(value, texture);
  return texture;
}

/** Small round label with a count, placed on top of a stack of bills. */
export function countChipTexture(count: number): CanvasTexture {
  const cached = chipCache.get(count);
  if (cached) return cached;
  const size = 96;
  const [canvas, ctx] = make(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = "#1d1a17";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${count >= 10 ? 44 : 52}px ${TILE_FONT}`;
  ctx.fillText(`×${count}`, size / 2, size / 2 + 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  chipCache.set(count, texture);
  return texture;
}
