import { useEffect, useRef, useState } from "react";
import type { GameState, LogEntry } from "../game";

const MAX_VISIBLE = 4;

interface Banner {
  readonly id: number;
  readonly entry: LogEntry;
}

export interface AnnouncerProps {
  readonly state: GameState;
  /** While true (dice flying, pawn hopping) new events are held back. */
  readonly paused: boolean;
  /** How long each banner stays. */
  readonly seconds: number;
}

/**
 * Big, short-lived banners for every game event, so everyone at the table
 * sees what just happened without reading the log.
 */
export function Announcer({ state, paused, seconds }: AnnouncerProps) {
  const seen = useRef(state.log.length);
  const nextId = useRef(0);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    if (paused) return;
    if (state.log.length < seen.current) seen.current = 0; // new game
    const fresh = state.log.slice(seen.current);
    seen.current = state.log.length;
    if (fresh.length === 0) return;
    const added = fresh.map((entry) => ({ id: nextId.current++, entry }));
    setBanners((current) => [...current, ...added].slice(-MAX_VISIBLE));
    const timers = added.map((banner, i) =>
      setTimeout(() => setBanners((current) => current.filter((b) => b.id !== banner.id)), seconds * 1000 + i * 400),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.log, paused, seconds]);

  if (banners.length === 0) return null;
  const colorOf = (id: string) => state.players.find((p) => p.id === id)?.color ?? "#000";
  return (
    <div className="announcer" aria-live="polite">
      {banners.map((banner) => (
        <div key={banner.id} className="banner">
          <span className="dot" style={{ background: colorOf(banner.entry.playerId) }} />
          {banner.entry.text}
        </div>
      ))}
    </div>
  );
}
