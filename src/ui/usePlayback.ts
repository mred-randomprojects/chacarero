import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, GameState } from "../game";
import { CUE_LEAD_SECONDS, eventSeconds } from "../game";
import { sfx } from "../audio/sfx";
import { effectsBus } from "../scene/effectsBus";
import { pawnPath } from "../scene/pawnPath";
import type { ViewState } from "./playbackView";
import { applyEvent, beginReplay, viewOf } from "./playbackView";

export type { ViewState } from "./playbackView";

export interface Walk {
  readonly id: number;
  readonly playerId: string;
  readonly route: readonly number[];
  readonly jump: boolean;
}

export interface PlaybackOptions {
  /** Seconds a plain banner stays; other steps scale from it. */
  readonly bannerSeconds: number;
}

export interface Playback {
  readonly view: ViewState;
  /** True while events are being replayed; decisions wait. */
  readonly busy: boolean;
  /** The event being shown, if any. */
  readonly current: GameEvent | null;
  /** The pawn walk in progress, for the scene. */
  readonly walk: Walk | null;
  /** Feed the events of a new state (call right after an action). */
  readonly enqueue: (after: GameState) => void;
  /** Resets the view to a state without replaying anything. */
  readonly reset: (state: GameState) => void;
  /** Finishes the current step at once. */
  readonly skip: () => void;
  /** The scene reports the walking pawn has arrived. */
  readonly onPawnArrive: () => void;
}

/**
 * Replays the events of each action one at a time: shows the banner, runs
 * the matching animation (bills flying, a card sliding, the pawn walking),
 * waits, then updates what the table shows. Decisions are held back until
 * the replay is over, so everyone at the table follows what happened.
 */
export function usePlayback(initial: GameState | null, options: PlaybackOptions): Playback {
  const [view, setView] = useState<ViewState>(() =>
    initial ? viewOf(initial) : { cash: {}, holdings: {}, positions: {}, phase: { type: "gameOver", winnerId: "" }, currentPlayerId: "", cardOnTable: null, deedOnOffer: null },
  );
  const [current, setCurrent] = useState<GameEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [walk, setWalk] = useState<Walk | null>(null);
  const queue = useRef<{ event: GameEvent; final: GameState }[]>([]);
  const running = useRef(false);
  const skipResolve = useRef<(() => void) | null>(null);
  const arriveResolve = useRef<(() => void) | null>(null);
  const walkCounter = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const scale = useRef(options.bannerSeconds / 3);
  scale.current = options.bannerSeconds / 3;

  const wait = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));

  const animate = useCallback((event: GameEvent, before: ViewState): Promise<void> => {
    switch (event.type) {
      case "move": {
        const route = pawnPath(event.from, event.to, event.kind);
        walkCounter.current += 1;
        setWalk({ id: walkCounter.current, playerId: event.playerId, route, jump: event.kind === "jump" });
        return new Promise<void>((resolve) => {
          arriveResolve.current = resolve;
        });
      }
      case "transfer":
        return effectsBus.request({ kind: "money", from: event.from, to: event.to, amount: event.amount });
      case "deed":
        return effectsBus.request({ kind: "deed", deedId: event.deedId, from: event.from, to: event.to });
      case "building": {
        const previous = before.holdings[event.deedId];
        const levelBefore = previous ? (previous.estancia ? 5 : previous.chacras) : 0;
        const levelAfter = event.estancia ? 5 : event.chacras;
        if (levelAfter === levelBefore) return Promise.resolve();
        const removed = levelAfter < levelBefore;
        const estancia = removed ? previous?.estancia === true : event.estancia;
        return effectsBus.request({ kind: "building", deedId: event.deedId, chacras: event.chacras, estancia, removed });
      }
      case "card":
        return effectsBus.request({ kind: "revealCard", deck: event.deck, cardId: event.cardId, playerId: event.playerId });
      case "jail":
        sfx.play("jail");
        return Promise.resolve();
      case "bankrupt":
        sfx.play("bankrupt");
        return Promise.resolve();
      case "turn":
        sfx.play("turn", { volume: 0.6 });
        return Promise.resolve();
      case "mortgage":
        sfx.play(event.mortgaged ? "mortgage" : "unmortgage");
        return Promise.resolve();
      default:
        return Promise.resolve();
    }
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    while (queue.current.length > 0) {
      const item = queue.current.shift();
      if (!item) break;
      const { event, final } = item;
      setCurrent(event);
      const skipped = new Promise<void>((resolve) => {
        skipResolve.current = resolve;
      });
      // The table changes the moment the animation lands (the card is in the hand as the flying one
      // disappears, the pawn stands on the square as it stops), while the banner stays a while longer.
      let applied = false;
      const apply = () => {
        if (applied) return;
        applied = true;
        const next = applyEvent(viewRef.current, event, final);
        viewRef.current = next;
        setView(next);
      };
      // A drawn card is on the table before it rises (the rise is what the step waits for); everything
      // else lands first and then changes the table.
      if (event.type === "card") apply();
      // Flights and drops start a beat after their banner, so the camera gets there first.
      const lead = event.type === "transfer" || event.type === "deed" || event.type === "building" ? wait(CUE_LEAD_SECONDS * scale.current) : Promise.resolve();
      const animation = lead.then(() => animate(event, viewRef.current)).then(apply);
      const step = Promise.all([animation, wait(eventSeconds(event) * scale.current)]).then(() => undefined);
      await Promise.race([step, skipped]);
      skipResolve.current = null;
      arriveResolve.current = null;
      apply();
      setWalk(null);
      if (queue.current.length === 0) {
        // Whatever was skipped or approximated, the table ends up matching the real state.
        viewRef.current = viewOf(final);
        setView(viewRef.current);
      }
    }
    setCurrent(null);
    running.current = false;
    setBusy(false);
  }, [animate]);

  const enqueue = useCallback(
    (after: GameState) => {
      if (after.events.length === 0) {
        viewRef.current = viewOf(after);
        setView(viewRef.current);
        return;
      }
      // What the new state no longer holds up (the card just applied, the deed just bought) goes down at once.
      viewRef.current = beginReplay(viewRef.current, after);
      setView(viewRef.current);
      queue.current.push(...after.events.map((event) => ({ event, final: after })));
      void run();
    },
    [run],
  );

  const reset = useCallback((state: GameState) => {
    queue.current = [];
    effectsBus.flush();
    skipResolve.current?.();
    viewRef.current = viewOf(state);
    setView(viewRef.current);
  }, []);

  const skip = useCallback(() => {
    effectsBus.flush();
    arriveResolve.current?.();
    skipResolve.current?.();
  }, []);

  const onPawnArrive = useCallback(() => {
    arriveResolve.current?.();
    arriveResolve.current = null;
  }, []);

  useEffect(() => () => effectsBus.flush(), []);

  return { view, busy, current, walk, enqueue, reset, skip, onPawnArrive };
}
