import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { Vector3 } from "three";
import type { Anchors } from "./anchors";
import type { BoardProps } from "./Board";
import { BOARD_LAYOUT, Board, SLAB_MARGIN, TABLE_Y } from "./Board";
import { DevFrames } from "./DevFrames";
import type { EffectsProps } from "./Effects";
import { Effects } from "./Effects";
import type { CameraRigProps } from "./CameraRig";
import { CameraRig } from "./CameraRig";
import { OVERVIEW } from "./cameraViews";
import type { DiceThrow, PawnObstacle } from "./Dice";
import { Dice } from "./Dice";
import { pawnWorld, throwTarget } from "./pawnSpots";
import { useFontsReady } from "./useFontsReady";

export interface SceneProps extends BoardProps, CameraRigProps, Omit<EffectsProps, "anchors"> {
  /** Whose pawn the dice are thrown at (the player rolling). */
  readonly throwerId: string;
  readonly shaking: boolean;
  readonly throwing: DiceThrow | null;
  readonly onDiceLanded: (id: number, at: Vector3) => void;
  readonly onDicePresenting: (id: number, doubles: boolean) => void;
  readonly onDiceSettled: (id: number) => void;
}

/**
 * Full-viewport Three.js canvas with lights, camera and orbit controls. The
 * board itself is only mounted once the tile fonts are available.
 */
export function Scene({ goTo, followPawn, onUserControl, throwerId, shaking, throwing, onDiceLanded, onDicePresenting, onDiceSettled, cardOnTable, ...board }: SceneProps) {
  const fontsReady = useFontsReady();
  const obstacles = useMemo<readonly PawnObstacle[]>(() => board.pawns.map((pawn, slot) => ({ id: pawn.id, position: pawnWorld(BOARD_LAYOUT, pawn.position, slot) })), [board.pawns]);
  const thrower = board.pawns.find((p) => p.id === throwerId);
  const target = useMemo(() => throwTarget(BOARD_LAYOUT, thrower?.position ?? 0), [thrower?.position]);
  const anchors = useMemo<Anchors>(
    () => ({ layout: BOARD_LAYOUT, slabMargin: SLAB_MARGIN, sides: new Map(board.seats.map((seat) => [seat.playerId, seat.side])), tableY: TABLE_Y }),
    [board.seats],
  );
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [...OVERVIEW.position], fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => board.onHover(null)}
    >
      <hemisphereLight args={["#fff5e0", "#3a2a1a", 0.55]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[14, 28, 12]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      />
      {fontsReady && (
        <>
          <Board {...board} />
          <Effects anchors={anchors} cardOnTable={cardOnTable} />
          <Dice target={target} obstacles={obstacles} shaking={shaking} throwing={throwing} tableY={0} onLanded={onDiceLanded} onPresenting={onDicePresenting} onSettled={onDiceSettled} />
        </>
      )}
      <CameraRig goTo={goTo} followPawn={followPawn} onUserControl={onUserControl} />
      {import.meta.env.DEV && <DevFrames />}
    </Canvas>
  );
}
