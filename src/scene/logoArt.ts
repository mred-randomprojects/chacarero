/**
 * The Terrateniente identity ("Portón de estancia"): the arched sign over an
 * estancia's entrance, two posts and the tranquera below, on a plank table.
 * Drawn with the canvas API only, so the same function paints the logo on the
 * board and in the menus (an SVG-as-image could not use the web fonts).
 */

export const LOGO_FONT = "'Alfa Slab One', Georgia, serif";
const SUBTITLE_FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";

/** The logo's own coordinate box; callers scale the context to fit it. */
export const LOGO_W = 800;
export const LOGO_H = 320;

const WALNUT_TOP = "#6b4228";
const WALNUT_BOTTOM = "#3f2717";
const WALNUT_EDGE = "#2a180d";
const CAP = "#2f1c10";
const RAIL = "#8a5a36";
const CREAM = "#f3e6c8";
const MUSTARD = "#d9a441";

type Point = readonly [number, number];

function quadratic(p0: Point, p1: Point, p2: Point, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

/**
 * Writes `text` along a quadratic curve, centred on it and squeezed or
 * stretched to exactly `length` (like SVG's textLength), each glyph turned to
 * follow the curve.
 */
function textOnCurve(ctx: CanvasRenderingContext2D, text: string, curve: readonly [Point, Point, Point], length: number): void {
  const samples: { x: number; y: number; s: number }[] = [];
  let total = 0;
  let prev = quadratic(...curve, 0);
  for (let i = 0; i <= 200; i++) {
    const p = quadratic(...curve, i / 200);
    total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    samples.push({ x: p[0], y: p[1], s: total });
    prev = p;
  }
  const at = (s: number): { x: number; y: number; angle: number } => {
    const i = Math.max(1, samples.findIndex((p) => p.s >= s));
    const a = samples[i - 1] ?? samples[0];
    const b = samples[i] ?? samples[samples.length - 1];
    if (!a || !b) return { x: 0, y: 0, angle: 0 };
    const f = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  // Glyphs are placed one by one, so scale by their summed widths (no kerning), not the word's.
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const scale = length / widths.reduce((a, b) => a + b, 0);
  let s = (total - length) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  [...text].forEach((ch, i) => {
    const advance = (widths[i] ?? 0) * scale;
    const { x, y, angle } = at(s + advance / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, 1);
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    s += advance;
  });
}

/** Centred text forced to an exact width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number): void {
  const scale = width / ctx.measureText(text).width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export interface LogoOptions {
  /** Colour of "UN JUEGO DE CAMPO": dark on light backgrounds, cream on the wooden table. */
  readonly subtitle?: string;
  /** Soft shadow under the whole sign, for when it sits on the table. */
  readonly shadow?: boolean;
}

/** Paints the logo into the 800×320 box at the context's current transform. */
export function drawLogo(ctx: CanvasRenderingContext2D, { subtitle = "#4a2e1c", shadow = false }: LogoOptions = {}): void {
  ctx.save();
  const walnut = ctx.createLinearGradient(0, 30, 0, 320);
  walnut.addColorStop(0, WALNUT_TOP);
  walnut.addColorStop(1, WALNUT_BOTTOM);
  ctx.lineJoin = "round";
  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
  }

  const shape = (draw: () => void, fill: string | CanvasGradient, stroke = WALNUT_EDGE, width = 3): void => {
    ctx.beginPath();
    draw();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
    if (shadow) ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  };

  // The gate first, so the posts and the sign overlap it.
  for (const y of [238, 266, 294]) shape(() => ctx.roundRect(112, y, 576, 14, 3), RAIL, WALNUT_EDGE, 2.5);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = RAIL;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(118, 306);
  ctx.lineTo(398, 240);
  ctx.moveTo(682, 306);
  ctx.lineTo(402, 240);
  ctx.stroke();
  if (shadow) ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  shape(() => ctx.rect(394, 232, 12, 80), WALNUT_TOP);

  for (const x of [64, 688]) {
    shape(() => ctx.roundRect(x, 46, 48, 266, 4), walnut);
    shape(() => ctx.roundRect(x - 8, 36, 64, 16, 3), CAP);
  }
  shape(() => {
    ctx.moveTo(104, 126);
    ctx.quadraticCurveTo(400, 26, 696, 126);
    ctx.lineTo(696, 210);
    ctx.quadraticCurveTo(400, 118, 104, 210);
    ctx.closePath();
  }, walnut);
  ctx.shadowColor = "transparent";

  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = MUSTARD;
  ctx.lineWidth = 2;
  for (const y of [150, 190]) {
    ctx.beginPath();
    ctx.moveTo(118, y);
    ctx.quadraticCurveTo(400, y - 92, 682, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.font = `60px ${LOGO_FONT}`;
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = WALNUT_EDGE;
  ctx.lineWidth = 1.5;
  textOnCurve(ctx, "TERRATENIENTE", [[128, 178], [400, 84], [672, 178]], 520);

  ctx.fillStyle = MUSTARD;
  for (const x of [120, 680]) {
    ctx.beginPath();
    ctx.arc(x, 136, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = `700 22px ${SUBTITLE_FONT}`;
  ctx.letterSpacing = "3px";
  ctx.fillStyle = subtitle;
  fitText(ctx, "UN JUEGO DE CAMPO", 400, 226, 220);
  ctx.restore();
}

/**
 * The plank table that fills the centre of the board, `size` pixels square,
 * covering the square around the inner hexagon. Seeded, so it never changes.
 */
export function drawPlankTable(ctx: CanvasRenderingContext2D, size: number): void {
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const plank = size / 9.3;
  const shades = ["#7a4f2e", "#865733", "#6f4629", "#83552f"];
  for (let y = 0, i = 0; y < size; y += plank, i++) {
    ctx.fillStyle = shades[i % shades.length] ?? "#7a4f2e";
    ctx.fillRect(0, y, size, plank);
    ctx.strokeStyle = "rgba(74, 46, 28, 0.35)";
    ctx.lineWidth = size / 900;
    for (let g = 0; g < 5; g++) {
      const gy = y + plank * (0.15 + g * 0.18) + rand() * plank * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.quadraticCurveTo(size * (0.3 + rand() * 0.4), gy + (rand() - 0.5) * plank * 0.25, size, gy);
      ctx.stroke();
    }
    // Two seams per plank, staggered, like boards laid end to end.
    ctx.strokeStyle = "#3b2414";
    ctx.lineWidth = size / 450;
    for (const x of [size * (0.1 + rand() * 0.35), size * (0.55 + rand() * 0.35)]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plank);
      ctx.stroke();
    }
    ctx.strokeStyle = CAP;
    ctx.lineWidth = size / 360;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.52);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.4)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
}
