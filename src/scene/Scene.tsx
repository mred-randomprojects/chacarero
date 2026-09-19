import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { BoardProps } from "./Board";
import { Board } from "./Board";
import { useFontsReady } from "./useFontsReady";

/**
 * Full-viewport Three.js canvas with lights, camera and orbit controls. The
 * board itself is only mounted once the tile fonts are available.
 */
export function Scene(props: BoardProps) {
  const fontsReady = useFontsReady();
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 21, 25], fov: 38, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onHover(null)}
    >
      <hemisphereLight args={["#fff5e0", "#3a2a1a", 0.55]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[14, 28, 12]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
      />
      {fontsReady && <Board {...props} />}
      <OrbitControls
        enablePan={false}
        minDistance={12}
        maxDistance={70}
        maxPolarAngle={Math.PI * 0.42}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
