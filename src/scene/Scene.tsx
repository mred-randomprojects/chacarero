import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { Anchors } from "./anchors";
import type { BoardProps } from "./Board";
import { BOARD_LAYOUT, Board, SLAB_MARGIN, TABLE_Y } from "./Board";
import { Effects } from "./Effects";
import type { CameraRigProps } from "./CameraRig";
import { CameraRig } from "./CameraRig";
import { OVERVIEW } from "./cameraViews";
import type { DiceThrow } from "./Dice";
import { Dice } from "./Dice";
import { seatFrame } from "./seats";
import { useFontsReady } from "./useFontsReady";

export interface SceneProps extends BoardProps, CameraRigProps {
  /** Side of the player who holds the dice. */
  readonly diceSide: number;
  readonly shaking: boolean;
  readonly throwing: DiceThrow | null;
  readonly onDiceSettled: (id: number) => void;
}

/**
 * Full-viewport Three.js canvas with lights, camera and orbit controls. The
 * board itself is only mounted once the tile fonts are available.
 */
export function Scene({ goTo, followPawn, diceSide, shaking, throwing, onDiceSettled, ...board }: SceneProps) {
  const fontsReady = useFontsReady();
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
          <Effects anchors={anchors} />
          <Dice frame={seatFrame(BOARD_LAYOUT, SLAB_MARGIN, diceSide)} shaking={shaking} throwing={throwing} tableY={0} onSettled={onDiceSettled} />
        </>
      )}
      <CameraRig goTo={goTo} followPawn={followPawn} />
    </Canvas>
  );
}
