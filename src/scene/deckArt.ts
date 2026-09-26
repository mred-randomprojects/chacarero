import type { Deck } from "../game";

/**
 * How each deck looks everywhere it is drawn: the board slot, its squares,
 * the card faces and backs. Suerte is a horseshoe on sky blue; Yeta a black
 * cat on wine red.
 */
export const DECK_ART: Readonly<Record<Deck, { readonly label: string; readonly color: string }>> = {
  suerte: { label: "SUERTE", color: "#2a7fb8" },
  yeta: { label: "YETA", color: "#9a2c3e" },
};

const CREAM = "#f7f2e4";
const CAT_BLACK = "#141014";
const CAT_EYES = "#f2d21c";

/** SVG paths in a 100×100 box, drawn through Path2D so canvas and SVG share them. */
const HORSESHOE = [
  "M18 12 H38 V56 A12 12 0 0 0 62 56 V12 H82 V56 A32 32 0 0 1 18 56 Z",
  // Nail holes, cut out with the even-odd rule.
  ...[
    [28, 24],
    [28, 42],
    [72, 24],
    [72, 42],
    [34.4, 71.6],
    [65.6, 71.6],
  ].map(([x = 0, y = 0]) => `M${x - 3} ${y} a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z`),
].join(" ");

/** Filled one by one: overlapping parts would cancel out under a single nonzero fill. */
const CAT_PARTS = [
  "M30 94 C24 72 32 56 50 55 C68 56 76 72 70 94 Z",
  "M33 38 A17 17 0 1 0 67 38 A17 17 0 1 0 33 38 Z",
  "M35 32 L33 10 L49 23 Z",
  "M65 32 L67 10 L51 23 Z",
  "M68 90 C88 92 94 72 84 60 C84 72 80 84 66 84 Z",
];

const CAT_EYE_CENTRES = [
  [43, 38],
  [57, 38],
] as const;

/**
 * Draws a deck's symbol centred on (cx, cy), `size` pixels across. The
 * horseshoe is cream so it reads on the blue; the cat is black with yellow eyes.
 */
export function drawDeckSymbol(ctx: CanvasRenderingContext2D, deck: Deck, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 100, size / 100);
  if (deck === "suerte") {
    ctx.fillStyle = CREAM;
    ctx.fill(new Path2D(HORSESHOE), "evenodd");
  } else {
    ctx.fillStyle = CAT_BLACK;
    for (const part of CAT_PARTS) ctx.fill(new Path2D(part));
    ctx.fillStyle = CAT_EYES;
    for (const [x, y] of CAT_EYE_CENTRES) {
      ctx.beginPath();
      ctx.ellipse(x, y, 3.2, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
