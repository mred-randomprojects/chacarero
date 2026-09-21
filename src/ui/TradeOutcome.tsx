import { useEffect, useRef } from "react";
import type { GameState } from "../game";
import { getPlayer } from "../game";
import { TokenIcon } from "./TokenIcon";

export interface TradeOutcomeView {
  readonly id: number;
  readonly kind: "accepted" | "rejected";
  readonly fromId: string;
  readonly toId: string;
}

export interface TradeOutcomeProps {
  readonly outcome: TradeOutcomeView;
  readonly state: GameState;
  readonly onDone: () => void;
}

const ACCEPTED_MS = 3_200;
const REJECTED_MS = 2_600;
const CONFETTI_COLORS = ["#f2c21c", "#c8261f", "#1f9a3c", "#1f5fd6", "#f28c1c", "#8e3fb0", "#f7f2e4"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  w: number;
  h: number;
  color: string;
}

/** Confetti bursting from the middle of the screen, drawn on a canvas for the length of the celebration. */
function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    node.width = node.clientWidth;
    node.height = node.clientHeight;
    const particles: Particle[] = Array.from({ length: 160 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 6 + Math.random() * 9;
      return {
        x: node.width / 2 + (Math.random() - 0.5) * 80,
        y: node.height * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? "#f2c21c",
      };
    });
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      ctx.clearRect(0, 0, node.width, node.height);
      for (const p of particles) {
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2) / 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < ACCEPTED_MS / 1000) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas className="confetti" ref={canvas} aria-hidden />;
}

/**
 * The moment a trade is answered: a handshake with confetti when the deal
 * closes, a shaking "no deal" when it is turned down. Sits over everything
 * for a few seconds and takes itself down.
 */
export function TradeOutcome({ outcome, state, onDone }: TradeOutcomeProps) {
  const from = getPlayer(state, outcome.fromId);
  const to = getPlayer(state, outcome.toId);
  const accepted = outcome.kind === "accepted";
  useEffect(() => {
    const id = setTimeout(onDone, accepted ? ACCEPTED_MS : REJECTED_MS);
    return () => clearTimeout(id);
  }, [accepted, onDone]);
  return (
    <div className={`trade-outcome ${outcome.kind}`} aria-live="polite">
      {accepted && <Confetti />}
      <div className="trade-outcome-card">
        <div className="trade-outcome-parties">
          <TokenIcon token={from.token} size={44} />
          <span className="trade-outcome-glyph">{accepted ? "🤝" : "🚫"}</span>
          <TokenIcon token={to.token} size={44} />
        </div>
        <h2>{accepted ? "¡Trato hecho!" : "Sin trato"}</h2>
        <p>{accepted ? `${to.name} aceptó el canje de ${from.name}.` : `${to.name} rechazó el canje de ${from.name}.`}</p>
      </div>
    </div>
  );
}
