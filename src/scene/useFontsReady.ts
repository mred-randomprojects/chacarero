import { useEffect, useState } from "react";
import { TILE_FONT, TITLE_FONT } from "./tileTexture";

const FONT_TIMEOUT_MS = 2_500;

/**
 * Resolves once the web fonts used on the canvas tiles are loaded (or after a
 * short timeout when offline, so the board still renders with fallbacks).
 * Textures are drawn only after this flips to true, otherwise the first paint
 * would bake the fallback font into every tile.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts) {
      setReady(true);
      return;
    }
    const loads = Promise.all([
      fonts.load(`700 24px ${TILE_FONT}`),
      fonts.load(`800 24px ${TILE_FONT}`),
      fonts.load(`500 24px ${TILE_FONT}`),
      fonts.load(`24px ${TITLE_FONT}`),
    ]);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    Promise.race([loads, timeout])
      .catch(() => undefined)
      .then(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
