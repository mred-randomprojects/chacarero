import { useEffect, useRef } from "react";
import type { Party } from "../game";
import { pesos } from "../game";
import { effectsBus } from "../scene/effectsBus";
import { partyKey } from "./partyKey";

/** Bill colours by denomination, matching the ones on the table. */
const BILLS: readonly { readonly value: number; readonly color: string }[] = [
  { value: 5000, color: "#d98c7a" },
  { value: 2000, color: "#b59ad6" },
  { value: 1000, color: "#8fcf9a" },
  { value: 500, color: "#e9a0b5" },
  { value: 200, color: "#f0a75a" },
  { value: 100, color: "#e8d66b" },
];

const FLIGHT_MS = 800;
const STAGGER_MS = 90;

function rectOf(party: Party): DOMRect | null {
  const node = document.querySelector<HTMLElement>(`[data-party="${partyKey(party)}"]`);
  return node ? node.getBoundingClientRect() : null;
}

/** Spawns the bills for one transfer and removes them when they land. */
function fly(layer: HTMLElement, from: Party, to: Party, amount: number): void {
  const a = rectOf(from);
  const b = rectOf(to);
  if (!a || !b) return;
  const base = layer.getBoundingClientRect();
  const count = Math.min(8, Math.max(2, Math.round(amount / 1_000) + 1));
  const start = { x: a.left + a.width / 2 - base.left, y: a.top + a.height / 2 - base.top };
  const end = { x: b.left + b.width / 2 - base.left, y: b.top + b.height / 2 - base.top };
  const lift = -Math.max(90, Math.min(220, Math.abs(end.x - start.x) * 0.45));
  for (let i = 0; i < count; i++) {
    const bill = document.createElement("div");
    const spec = BILLS[i % BILLS.length] ?? BILLS[0];
    bill.className = "hud-bill";
    if (spec) {
      bill.style.background = spec.color;
      bill.textContent = pesos(spec.value);
    }
    const jitterX = (Math.random() - 0.5) * 40;
    const jitterY = (Math.random() - 0.5) * 24;
    const twist = (Math.random() - 0.5) * 50;
    layer.appendChild(bill);
    const animation = bill.animate(
      [
        { transform: `translate(${start.x + jitterX}px, ${start.y + jitterY}px) rotate(${twist}deg) scale(0.7)`, opacity: 0 },
        { transform: `translate(${(start.x + end.x) / 2 + jitterX}px, ${(start.y + end.y) / 2 + lift + jitterY}px) rotate(${-twist}deg) scale(1.1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${end.x + jitterX * 0.4}px, ${end.y + jitterY * 0.4}px) rotate(${twist * 0.5}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration: FLIGHT_MS, delay: i * STAGGER_MS, easing: "cubic-bezier(0.4, 0, 0.3, 1)", fill: "both" },
    );
    animation.onfinish = () => bill.remove();
  }
  // Floating "−$x" over the payer and "+$x" over the receiver.
  const tag = (at: { x: number; y: number }, text: string, className: string, delay: number) => {
    const node = document.createElement("div");
    node.className = `hud-amount ${className}`;
    node.textContent = text;
    layer.appendChild(node);
    const animation = node.animate(
      [
        { transform: `translate(-50%, 0) translate(${at.x}px, ${at.y - 20}px)`, opacity: 0 },
        { transform: `translate(-50%, 0) translate(${at.x}px, ${at.y - 44}px)`, opacity: 1, offset: 0.25 },
        { transform: `translate(-50%, 0) translate(${at.x}px, ${at.y - 78}px)`, opacity: 0 },
      ],
      { duration: 1_300, delay, easing: "ease-out", fill: "both" },
    );
    animation.onfinish = () => node.remove();
  };
  tag(start, `−${pesos(amount)}`, "minus", 0);
  tag(end, `+${pesos(amount)}`, "plus", FLIGHT_MS * 0.6 + STAGGER_MS * (count - 1));
}

/**
 * Money leaving one player's card and landing in another's (or the bank's)
 * whenever the table replays a transfer: the same effects the 3D scene
 * renders as bills on the felt, mirrored on the HUD so the payment is
 * legible from any camera angle.
 */
export function MoneyFlights() {
  const layer = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<number>());
  useEffect(
    () =>
      effectsBus.subscribe((active) => {
        const node = layer.current;
        if (!node) return;
        for (const entry of active) {
          if (entry.effect.kind !== "money" || seen.current.has(entry.id)) continue;
          seen.current.add(entry.id);
          fly(node, entry.effect.from, entry.effect.to, entry.effect.amount);
        }
        if (seen.current.size > 200) seen.current = new Set([...seen.current].slice(-50));
      }),
    [],
  );
  return <div className="hud-flights" ref={layer} aria-hidden />;
}
