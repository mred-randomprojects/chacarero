import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Scene } from "three";

declare global {
  interface Window {
    /**
     * Dev-only: drive the scene's frame loop from a timer instead of
     * requestAnimationFrame, so a hidden or throttled tab still animates at
     * a steady pace and scripted checks can sample it. `run(fps)` takes over,
     * `stop()` hands the loop back to the browser.
     */
    __chacareroFrames?: { readonly run: (fps?: number) => void; readonly stop: () => void; readonly scene: Scene };
  }
}

/** Mounts the dev frame stepper on `window` while the canvas lives. */
export function DevFrames() {
  const advance = useThree((s) => s.advance);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      setFrameloop("always");
    };
    window.__chacareroFrames = {
      run: (fps = 60) => {
        stop();
        setFrameloop("never");
        timer = setInterval(() => advance(performance.now()), 1000 / fps);
      },
      stop,
      scene,
    };
    // On unmount only the timer stops; the hook stays (a hot reload re-registers it, in either order).
    return stop;
  }, [advance, setFrameloop, scene]);
  return null;
}
