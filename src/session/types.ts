import type { ActionRequest, ActionType, GameState } from "../game";

export type SessionMode = "local" | "online";

/**
 * What the game screen needs from wherever the game lives: the current state,
 * who this screen is, and a way to send moves. The local (hot-seat) session
 * applies moves itself; the online one sends them to the room server and
 * waits for the broadcast.
 */
export interface Session {
  readonly mode: SessionMode;
  readonly game: GameState;
  /** This screen's player online; null at a shared table, where whoever is on turn acts. */
  readonly you: string | null;
  /** Increments with every state change; the screen replays one step per increment. */
  readonly seq: number;
  readonly lastAction: ActionType | null;
  readonly lastActorId: string | null;
  /** Local-clock epoch ms when the current decision's default fires, or null. */
  readonly deadline: number | null;
  readonly shakingPlayerId: string | null;
  /** Players currently offline (online mode). */
  readonly offline: ReadonlySet<string>;
  readonly roomCode: string | null;
  readonly connection: "local" | "connecting" | "open" | "closed";
  readonly error: string | null;
  readonly dispatch: (action: ActionRequest) => void;
  readonly setShaking: (shaking: boolean) => void;
  readonly clearError: () => void;
  /** Leaves the table (online: leaves the room). */
  readonly leave: () => void;
  /** After a game: back to the lobby / setup. */
  readonly newGame: () => void;
}
