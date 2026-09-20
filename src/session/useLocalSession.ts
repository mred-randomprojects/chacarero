import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionRequest, ActionType, GameSetup, GameState, NewPlayer } from "../game";
import { allowedPlayerFor, applyActionRequest, autoResolveDebt, createGame, defaultAction, phaseSeconds, replaySeconds } from "../game";
import type { Session } from "./types";

export interface LocalSessionOptions {
  readonly players: readonly NewPlayer[];
  readonly setup: GameSetup;
  /** Multiplier for decision clocks; 0 disables them. */
  readonly countdownScale: number;
  /** Replay pace, as banner seconds (3 = default). */
  readonly bannerSeconds: number;
  readonly onLeave: () => void;
}

interface Turn {
  readonly game: GameState;
  readonly seq: number;
  readonly lastAction: ActionType | null;
  readonly lastActorId: string | null;
  readonly deadline: number | null;
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/**
 * Hot-seat session: everyone plays on this screen. Mirrors the server's
 * behaviour (seq, clocks, defaults) so the game screen cannot tell the two
 * apart.
 */
export function useLocalSession(options: LocalSessionOptions): Session & { readonly setGame: (game: GameState) => void } {
  const { players, setup, countdownScale, bannerSeconds, onLeave } = options;
  const clock = useCallback(
    (game: GameState, now: number): number | null => {
      if (countdownScale <= 0) return null;
      const seconds = phaseSeconds(game);
      if (seconds === null) return null;
      return now + Math.round((replaySeconds(game.events, bannerSeconds / 3) + seconds * countdownScale) * 1000);
    },
    [countdownScale, bannerSeconds],
  );

  const [turn, setTurn] = useState<Turn>(() => {
    const game = createGame({ players, ...setup });
    return { game, seq: 1, lastAction: null, lastActorId: null, deadline: clock(game, Date.now()) };
  });
  const [shakingPlayerId, setShakingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turnRef = useRef(turn);
  turnRef.current = turn;

  const apply = useCallback(
    (action: ActionRequest, resolveDebt = false) => {
      const current = turnRef.current;
      try {
        const actor = allowedPlayerFor(current.game, action);
        const game = resolveDebt ? autoResolveDebt(current.game) : applyActionRequest(current.game, action, [rollDie(), rollDie()]);
        if (game === current.game) return;
        const next: Turn = { game, seq: current.seq + 1, lastAction: action.type, lastActorId: actor, deadline: clock(game, Date.now()) };
        turnRef.current = next;
        setTurn(next);
        setShakingPlayerId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [clock],
  );

  // The table's clock: when a decision times out, the default happens by itself.
  useEffect(() => {
    const id = setInterval(() => {
      const current = turnRef.current;
      if (current.deadline === null || Date.now() < current.deadline) return;
      const action = defaultAction(current.game);
      if (!action) return;
      apply(action, current.game.phase.type === "awaitingPayment");
    }, 250);
    return () => clearInterval(id);
  }, [apply]);

  const setGame = useCallback(
    (game: GameState) => {
      const next: Turn = { game, seq: turnRef.current.seq + 1, lastAction: null, lastActorId: null, deadline: clock(game, Date.now()) };
      turnRef.current = next;
      setTurn(next);
    },
    [clock],
  );

  return useMemo(
    () => ({
      mode: "local" as const,
      game: turn.game,
      you: null,
      seq: turn.seq,
      lastAction: turn.lastAction,
      lastActorId: turn.lastActorId,
      deadline: turn.deadline,
      shakingPlayerId,
      offline: new Set<string>(),
      roomCode: null,
      connection: "local" as const,
      error,
      dispatch: (action: ActionRequest) => apply(action),
      setShaking: (shaking: boolean) => setShakingPlayerId(shaking ? allowedPlayerFor(turnRef.current.game, { type: "rollDice" }) : null),
      clearError: () => setError(null),
      leave: onLeave,
      newGame: onLeave,
      setGame,
    }),
    [turn, shakingPlayerId, error, apply, onLeave, setGame],
  );
}
