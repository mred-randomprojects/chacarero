import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionRequest } from "../game";
import type { ConnectionStatus } from "../net/client";
import { RoomClient } from "../net/client";
import type { RoomView } from "../net/protocol";
import type { Session } from "./types";

export interface OnlineState {
  readonly room: RoomView | null;
  readonly you: string | null;
  readonly status: ConnectionStatus;
  readonly error: string | null;
  readonly notFound: string | null;
  readonly left: boolean;
  /** Local clock minus server clock, from the last message. */
  readonly clockOffset: number;
}

/**
 * Owns one RoomClient for the given server and turns its messages into React
 * state. The room view is replaced whole on every server message; the game
 * screen replays the difference.
 */
export function useRoomClient(url: string | null, playerId: string): OnlineState & { readonly client: RoomClient | null; readonly clearError: () => void; readonly clearLeft: () => void } {
  const [state, setState] = useState<OnlineState>({ room: null, you: null, status: "closed", error: null, notFound: null, left: false, clockOffset: 0 });
  const [client, setClient] = useState<RoomClient | null>(null);

  useEffect(() => {
    if (!url) return;
    const created = new RoomClient(url, playerId, {
      onRoom: (room, you) => setState((s) => ({ ...s, room, you, notFound: null, left: false, clockOffset: Date.now() - room.now })),
      onError: (message) => setState((s) => ({ ...s, error: message })),
      onRoomNotFound: (code) => setState((s) => ({ ...s, notFound: code, room: null })),
      onLeft: () => setState((s) => ({ ...s, left: true, room: null })),
      onStatus: (status) => setState((s) => ({ ...s, status })),
    });
    created.connect();
    setClient(created);
    return () => {
      created.close();
      setClient(null);
    };
  }, [url, playerId]);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);
  const clearLeft = useCallback(() => setState((s) => ({ ...s, left: false, room: null })), []);

  return { ...state, client, clearError, clearLeft };
}

export interface OnlineSessionOptions {
  readonly client: RoomClient;
  readonly room: RoomView;
  readonly you: string;
  readonly status: ConnectionStatus;
  readonly clockOffset: number;
  readonly error: string | null;
  readonly clearError: () => void;
}

/** Adapts a live room to the Session the game screen renders. */
export function useOnlineSession({ client, room, you, status, clockOffset, error, clearError }: OnlineSessionOptions): Session {
  const game = room.game;
  if (!game) throw new Error("useOnlineSession needs a room with a game");
  const seqRef = useRef(room.seq);
  seqRef.current = room.seq;
  const offline = useMemo(() => new Set(room.players.filter((p) => !p.connected).map((p) => p.playerId)), [room.players]);

  return useMemo(
    () => ({
      mode: "online" as const,
      game,
      you,
      seq: room.seq,
      lastAction: room.lastAction,
      lastActorId: room.lastActorId,
      deadline: room.deadline === null ? null : room.deadline + clockOffset,
      shakingPlayerId: room.shakingPlayerId,
      offline,
      roomCode: room.code,
      connection: status,
      error,
      dispatch: (action: ActionRequest) => client.action(seqRef.current, action),
      setShaking: (shaking: boolean) => client.shake(shaking),
      clearError,
      leave: () => client.leave(),
      newGame: () => client.newGame(),
    }),
    [game, you, room, clockOffset, offline, status, error, client, clearError],
  );
}
