import { useEffect, useRef } from "react";
import { LOGO_H, LOGO_W, drawLogo } from "../scene/logoArt";
import { useFontsReady } from "../scene/useFontsReady";

interface LogoProps {
  /** CSS width in pixels; the height follows the logo's 5:2 proportions. */
  readonly width: number;
}

/**
 * The game's logo in the menus: the very drawing the table shows, painted on a
 * canvas at the screen's pixel density once the fonts are in.
 */
export function Logo({ width }: LogoProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fontsReady = useFontsReady();
  const height = (width * LOGO_H) / LOGO_W;

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx || !fontsReady) return;
    const density = window.devicePixelRatio || 1;
    element.width = Math.round(width * density);
    element.height = Math.round(height * density);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, element.width, element.height);
    ctx.scale(element.width / LOGO_W, element.height / LOGO_H);
    drawLogo(ctx);
  }, [fontsReady, width, height]);

  return <canvas ref={canvas} className="logo" role="img" aria-label="Terrateniente, un juego de campo" style={{ width, height }} />;
}
