import { useEffect, useRef } from "react";
import type { GameState } from "../game";

const VISIBLE = 40;

/** Scrolling list of the latest game events. */
export function LogPanel({ state }: { readonly state: GameState }) {
  const list = useRef<HTMLOListElement>(null);
  const entries = state.log.slice(-VISIBLE);
  useEffect(() => {
    const node = list.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [state.log.length]);
  const colorOf = (id: string) => state.players.find((p) => p.id === id)?.color ?? "#000";
  return (
    <ol className="log" ref={list}>
      {entries.map((entry, i) => (
        <li key={`${state.log.length - entries.length + i}`}>
          <span className="dot" style={{ background: colorOf(entry.playerId) }} />
          {entry.text}
        </li>
      ))}
    </ol>
  );
}
