import { useEffect, useState } from "react";
import type { DeedId, GameState } from "../game";
import { DeedCard } from "./DeedCard";

export interface LiftedDeedProps {
  readonly state: GameState;
  /** The deed on offer (or under the hammer) from the table's view; null takes it down. */
  readonly deedId: DeedId | null;
}

const OUT_MS = 380;

/**
 * The deed a player just landed on, lifted big in front of everyone: a fixed
 * size on screen (never clipped by the table), floating up from the bottom
 * and dropping away when the decision is made. Same artwork as on the felt.
 */
export function LiftedDeed({ state, deedId }: LiftedDeedProps) {
  const [shown, setShown] = useState<{ deedId: DeedId; leaving: boolean } | null>(deedId ? { deedId, leaving: false } : null);
  useEffect(() => {
    if (deedId) {
      setShown((current) => (current?.deedId === deedId && !current.leaving ? current : { deedId, leaving: false }));
      return;
    }
    setShown((current) => (current && !current.leaving ? { ...current, leaving: true } : current));
    const timer = setTimeout(() => setShown((current) => (current?.leaving ? null : current)), OUT_MS);
    return () => clearTimeout(timer);
  }, [deedId]);
  if (!shown) return null;
  return (
    <div className={`lifted-deed${shown.leaving ? " leaving" : ""}`} aria-hidden={shown.leaving}>
      <DeedCard key={shown.deedId} state={state} deedId={shown.deedId} width={300} />
    </div>
  );
}
