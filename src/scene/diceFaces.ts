import { CanvasTexture, SRGBColorSpace, Vector3 } from "three";

/**
 * Face value on each side of a BoxGeometry, in material-group order
 * (+x, -x, +y, -y, +z, -z). Opposite faces add up to seven, like real dice.
 */
export const FACE_VALUES = [1, 6, 2, 5, 3, 4] as const;

export const FACE_NORMALS: readonly Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];

/** Local-space normal of the face showing `value`. */
export function faceNormal(value: number): Vector3 {
  const index = FACE_VALUES.indexOf(value as (typeof FACE_VALUES)[number]);
  const normal = FACE_NORMALS[index];
  if (!normal) throw new Error(`No die face shows ${value}`);
  return normal;
}

const PIPS: Readonly<Record<number, readonly [number, number][]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.27, 0.27],
    [0.5, 0.5],
    [0.73, 0.73],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.27, 0.25],
    [0.27, 0.5],
    [0.27, 0.75],
    [0.73, 0.25],
    [0.73, 0.5],
    [0.73, 0.75],
  ],
};

/** Draws one die face with its pips. */
export function diceFaceTexture(value: number): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");
  ctx.fillStyle = "#fbf7ea";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#d9d2bd";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = "#1d1a17";
  for (const [x, y] of PIPS[value] ?? []) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, size * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
