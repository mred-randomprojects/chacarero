import type { ReactNode } from "react";
import type { TokenId } from "../game";

export interface TokenShapeProps {
  readonly token: TokenId;
  /** The token's colour (the player's colour). */
  readonly color: string;
  readonly dimmed?: boolean;
}

const DARK = "#2a2622";
const CREAM = "#f7f2e4";
const METAL = "#b8b8b8";

type Shape =
  | { readonly kind: "box"; readonly size: readonly [number, number, number] }
  | { readonly kind: "cylinder"; readonly top: number; readonly bottom: number; readonly height: number }
  | { readonly kind: "sphere"; readonly radius: number }
  | { readonly kind: "cone"; readonly radius: number; readonly height: number };

interface PartProps {
  readonly shape: Shape;
  readonly color: string;
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: readonly [number, number, number];
  readonly opacity: number;
  readonly metal?: boolean;
}

/** One primitive of a token; every part shares the material settings. */
function Part({ shape, color, position, rotation = [0, 0, 0], scale = [1, 1, 1], opacity, metal = false }: PartProps) {
  let geometry: ReactNode;
  switch (shape.kind) {
    case "box":
      geometry = <boxGeometry args={[...shape.size]} />;
      break;
    case "cylinder":
      geometry = <cylinderGeometry args={[shape.top, shape.bottom, shape.height, 20]} />;
      break;
    case "sphere":
      geometry = <sphereGeometry args={[shape.radius, 20, 14]} />;
      break;
    case "cone":
      geometry = <coneGeometry args={[shape.radius, shape.height, 16]} />;
      break;
  }
  return (
    <mesh castShadow position={[...position]} rotation={[...rotation]} scale={[...scale]}>
      {geometry}
      <meshStandardMaterial color={color} roughness={metal ? 0.3 : 0.5} metalness={metal ? 0.7 : 0} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

const box = (w: number, h: number, d: number): Shape => ({ kind: "box", size: [w, h, d] });
const cyl = (top: number, bottom: number, height: number): Shape => ({ kind: "cylinder", top, bottom, height });
const sphere = (radius: number): Shape => ({ kind: "sphere", radius });
const cone = (radius: number, height: number): Shape => ({ kind: "cone", radius, height });
const FLAT: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * The 3D piece for a token, built from primitives so it needs no assets.
 * Every piece fits a ~0.45 footprint (six share a tile) and faces +x.
 */
export function TokenShape({ token, color, dimmed = false }: TokenShapeProps) {
  const o = dimmed ? 0.35 : 1;
  const P = (shape: Shape, c: string, position: readonly [number, number, number], extra: Partial<Omit<PartProps, "shape" | "color" | "position" | "opacity">> = {}) => (
    <Part shape={shape} color={c} position={position} opacity={o} {...extra} />
  );
  /** Four legs at (±xFront/xBack, ±z). */
  const legs = (xFront: number, xBack: number, z: number, radius: number, height: number, c: string) => (
    <group>
      {[xFront, xBack].flatMap((x) =>
        [z, -z].map((zz) => (
          <Part key={`${x}:${zz}`} shape={cyl(radius, radius, height)} color={c} position={[x, height / 2, zz]} opacity={o} />
        )),
      )}
    </group>
  );
  switch (token) {
    case "tractor":
      return (
        <group>
          {P(box(0.34, 0.16, 0.2), color, [0.02, 0.22, 0])}
          {P(box(0.14, 0.16, 0.18), color, [-0.1, 0.38, 0])}
          {P(box(0.12, 0.1, 0.16), "#9ad6f0", [-0.1, 0.4, 0])}
          {P(cyl(0.01, 0.01, 0.16), DARK, [0.08, 0.38, 0.05])}
          {P(cyl(0.13, 0.13, 0.06), DARK, [-0.1, 0.13, 0.12], { rotation: FLAT })}
          {P(cyl(0.13, 0.13, 0.06), DARK, [-0.1, 0.13, -0.12], { rotation: FLAT })}
          {P(cyl(0.08, 0.08, 0.05), DARK, [0.13, 0.08, 0.11], { rotation: FLAT })}
          {P(cyl(0.08, 0.08, 0.05), DARK, [0.13, 0.08, -0.11], { rotation: FLAT })}
        </group>
      );
    case "vaca":
      return (
        <group>
          {P(box(0.38, 0.2, 0.2), color, [0, 0.3, 0])}
          {P(box(0.16, 0.15, 0.14), color, [0.24, 0.38, 0])}
          {P(box(0.06, 0.06, 0.12), CREAM, [0.33, 0.35, 0])}
          {P(cyl(0.012, 0.02, 0.09), CREAM, [0.22, 0.49, 0.05], { rotation: [0, 0, -0.5] })}
          {P(cyl(0.012, 0.02, 0.09), CREAM, [0.22, 0.49, -0.05], { rotation: [0, 0, -0.5] })}
          {legs(0.13, -0.13, 0.07, 0.035, 0.22, DARK)}
        </group>
      );
    case "caballo":
      return (
        <group>
          {P(box(0.36, 0.18, 0.16), color, [-0.02, 0.36, 0])}
          {P(box(0.1, 0.26, 0.1), color, [0.17, 0.5, 0], { rotation: [0, 0, -0.5] })}
          {P(box(0.18, 0.09, 0.09), color, [0.29, 0.62, 0])}
          {P(box(0.06, 0.14, 0.04), DARK, [0.14, 0.58, 0], { rotation: [0, 0, -0.5] })}
          {P(box(0.05, 0.16, 0.05), DARK, [-0.22, 0.32, 0], { rotation: [0, 0, 0.4] })}
          {legs(0.12, -0.14, 0.06, 0.03, 0.28, DARK)}
        </group>
      );
    case "mate":
      return (
        <group>
          {P(cyl(0.12, 0.13, 0.04), DARK, [0, 0.02, 0])}
          {P(sphere(0.19), color, [0, 0.24, 0], { scale: [1, 1.1, 1] })}
          {P(cyl(0.1, 0.1, 0.04), METAL, [0, 0.43, 0], { metal: true })}
          {P(cyl(0.012, 0.012, 0.42), METAL, [0.08, 0.6, 0.06], { rotation: [0.25, 0, -0.35], metal: true })}
          {P(sphere(0.028), METAL, [0.15, 0.79, 0.11], { metal: true })}
        </group>
      );
    case "bota":
      return (
        <group>
          {P(box(0.34, 0.09, 0.16), color, [0.06, 0.045, 0])}
          {P(box(0.16, 0.5, 0.16), color, [-0.03, 0.32, 0])}
          {P(box(0.17, 0.06, 0.17), CREAM, [-0.03, 0.55, 0])}
          {P(box(0.1, 0.05, 0.14), DARK, [-0.06, 0.025, 0])}
          {P(box(0.09, 0.07, 0.15), DARK, [0.185, 0.03, 0])}
        </group>
      );
    case "oveja":
      return (
        <group>
          {P(sphere(0.19), color, [0, 0.3, 0])}
          {P(sphere(0.12), color, [0.12, 0.38, 0.08])}
          {P(sphere(0.12), color, [-0.12, 0.38, -0.08])}
          {P(sphere(0.12), color, [0.1, 0.36, -0.1])}
          {P(sphere(0.12), color, [-0.1, 0.36, 0.1])}
          {P(sphere(0.1), DARK, [0.24, 0.36, 0])}
          {P(box(0.06, 0.03, 0.05), DARK, [0.24, 0.45, 0.07], { rotation: [0.6, 0, 0] })}
          {P(box(0.06, 0.03, 0.05), DARK, [0.24, 0.45, -0.07], { rotation: [-0.6, 0, 0] })}
          {legs(0.1, -0.1, 0.07, 0.03, 0.18, DARK)}
        </group>
      );
    case "gallo":
      return (
        <group>
          {P(sphere(0.17), color, [0, 0.34, 0], { scale: [1.15, 0.95, 0.85] })}
          {P(sphere(0.09), color, [0.17, 0.54, 0])}
          {P(box(0.08, 0.07, 0.03), "#c8261f", [0.15, 0.63, 0])}
          {P(cone(0.03, 0.09), "#f2c21c", [0.28, 0.53, 0], { rotation: [0, 0, -Math.PI / 2] })}
          {P(sphere(0.04), "#c8261f", [0.2, 0.47, 0])}
          {P(box(0.04, 0.26, 0.05), DARK, [-0.19, 0.5, 0], { rotation: [0, 0, 0.5] })}
          {P(box(0.04, 0.22, 0.05), color, [-0.2, 0.46, 0.05], { rotation: [0.3, 0, 0.8] })}
          {P(box(0.04, 0.22, 0.05), color, [-0.2, 0.46, -0.05], { rotation: [-0.3, 0, 0.8] })}
          {P(cyl(0.02, 0.02, 0.2), "#f2c21c", [0.03, 0.1, 0.05])}
          {P(cyl(0.02, 0.02, 0.2), "#f2c21c", [0.03, 0.1, -0.05])}
        </group>
      );
    case "sombrero":
      return (
        <group>
          {P(cyl(0.3, 0.3, 0.03), color, [0, 0.015, 0])}
          {P(cyl(0.16, 0.18, 0.24), color, [0, 0.15, 0])}
          {P(cyl(0.185, 0.185, 0.05), CREAM, [0, 0.07, 0])}
          {P(cyl(0.17, 0.16, 0.02), DARK, [0, 0.275, 0])}
        </group>
      );
  }
}
