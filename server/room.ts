/**
 * Pure room logic: who is in a room, the game it holds, and the clock that
 * makes decisions for absent players. No sockets in here, so it is easy to
 * test; index.ts wires it to the network.
 */
import type { ActionRequest, GameSetup, GameState } from "../src/game";
import { allowedPlayerFor, applyActionRequest, autoResolveDebt, createGame, defaultAction, phaseSeconds, replaySeconds } from "../src/game";
import type { Dice } from "../src/game";
import type { RoomPlayer, RoomStatus, RoomView } from "../src/net/protocol";

export const MAX_PLAYERS = 6;
export const PLAYER_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"] as const;

export interface RoomPlayerRecord extends RoomPlayer {
  readonly lastSeen: number;
}

export interface Room {
  readonly code: string;
  readonly hostId: string;
  readonly status: RoomStatus;
  readonly players: readonly RoomPlayerRecord[];
  readonly game: GameState | null;
  readonly seq: number;
  readonly lastAction: ActionRequest["type"] | null;
  readonly lastActorId: string | null;
  readonly deadline: number | null;
  readonly shakingPlayerId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A rule violation the client should see as a toast. */
export class RoomError extends Error {}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

export function createRoom(code: string, host: { playerId: string; name: string }, now: number): Room {
  return {
    code,
    hostId: host.playerId,
    status: "lobby",
    players: [{ playerId: host.playerId, name: host.name, color: PLAYER_COLORS[0], connected: true, lastSeen: now }],
    game: null,
    seq: 0,
    lastAction: null,
    lastActorId: null,
    deadline: null,
    shakingPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function touch(room: Room, now: number): Room {
  return { ...room, updatedAt: now };
}

function updatePlayerRecord(room: Room, playerId: string, patch: Partial<RoomPlayerRecord>): Room {
  return { ...room, players: room.players.map((p) => (p.playerId === playerId ? { ...p, ...patch } : p)) };
}

/** Joins a new player, or reconnects a known one (also during a game). */
export function joinRoom(room: Room, player: { playerId: string; name: string }, now: number): Room {
  const existing = room.players.find((p) => p.playerId === player.playerId);
  if (existing) return touch(updatePlayerRecord(room, player.playerId, { connected: true, lastSeen: now, name: player.name }), now);
  if (room.status !== "lobby") throw new RoomError("La partida ya empezó");
  if (room.players.length >= MAX_PLAYERS) throw new RoomError("La mesa está llena");
  const used = new Set(room.players.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  return touch({ ...room, players: [...room.players, { playerId: player.playerId, name: player.name, color, connected: true, lastSeen: now }] }, now);
}

export function renamePlayer(room: Room, playerId: string, name: string, now: number): Room {
  const next = updatePlayerRecord(room, playerId, { name });
  if (!next.game) return touch(next, now);
  return touch({ ...next, game: { ...next.game, players: next.game.players.map((p) => (p.id === playerId ? { ...p, name } : p)) } }, now);
}

/**
 * A player leaves for good. In the lobby they are removed (host passes on);
 * mid-game they only go offline, the clock plays their turns.
 */
export function leaveRoom(room: Room, playerId: string, now: number): Room {
  if (room.status !== "lobby") return markDisconnected(room, playerId, now);
  const players = room.players.filter((p) => p.playerId !== playerId);
  const hostId = room.hostId === playerId ? (players[0]?.playerId ?? room.hostId) : room.hostId;
  return touch({ ...room, players, hostId }, now);
}

export function markDisconnected(room: Room, playerId: string, now: number): Room {
  return touch(updatePlayerRecord(room, playerId, { connected: false, lastSeen: now }), now);
}

export function heartbeat(room: Room, playerId: string, now: number): Room {
  return updatePlayerRecord(room, playerId, { lastSeen: now });
}

/** Drops lobby players who have been offline longer than `maxIdleMs`. */
export function pruneIdle(room: Room, now: number, maxIdleMs: number): Room {
  if (room.status !== "lobby") return room;
  const players = room.players.filter((p) => p.connected || now - p.lastSeen < maxIdleMs);
  if (players.length === room.players.length) return room;
  const hostId = players.some((p) => p.playerId === room.hostId) ? room.hostId : (players[0]?.playerId ?? room.hostId);
  return touch({ ...room, players, hostId }, now);
}

/** Whether nobody has been seen for `maxIdleMs`; such rooms are deleted. */
export function isAbandoned(room: Room, now: number, maxIdleMs: number): boolean {
  return room.players.every((p) => !p.connected && now - p.lastSeen > maxIdleMs);
}

function withClock(room: Room, now: number): Room {
  const { game } = room;
  if (!game) return { ...room, deadline: null };
  const seconds = phaseSeconds(game);
  if (seconds === null) return { ...room, deadline: null };
  // Give every screen time to replay what just happened before the clock starts.
  return { ...room, deadline: now + Math.round((replaySeconds(game.events) + seconds) * 1000) };
}

export function startGame(room: Room, playerId: string, setup: GameSetup, now: number, random: () => number = Math.random): Room {
  if (room.hostId !== playerId) throw new RoomError("Solo el anfitrión puede empezar");
  if (room.status !== "lobby") throw new RoomError("La partida ya empezó");
  if (room.players.length < 2) throw new RoomError("Hacen falta al menos 2 jugadores");
  const game = createGame({ players: room.players.map((p) => ({ id: p.playerId, name: p.name, color: p.color })), ...setup, random });
  return touch(withClock({ ...room, status: "playing", game, seq: 1, lastAction: null, lastActorId: null, shakingPlayerId: null }, now), now);
}

/** Back to the lobby once a game is over (host only). */
export function newGame(room: Room, playerId: string, now: number): Room {
  if (room.hostId !== playerId) throw new RoomError("Solo el anfitrión puede volver a la sala");
  return touch({ ...room, status: "lobby", game: null, seq: 0, lastAction: null, lastActorId: null, deadline: null, shakingPlayerId: null }, now);
}

export function setShaking(room: Room, playerId: string, shaking: boolean): Room {
  if (!room.game) return room;
  if (allowedPlayerFor(room.game, { type: "rollDice" }) !== playerId) return room;
  return { ...room, shakingPlayerId: shaking ? playerId : null };
}

function afterChange(room: Room, game: GameState, action: ActionRequest["type"], actorId: string | null, now: number): Room {
  const status: RoomStatus = game.phase.type === "gameOver" ? "finished" : "playing";
  return touch(withClock({ ...room, game, status, seq: room.seq + 1, lastAction: action, lastActorId: actorId, shakingPlayerId: null }, now), now);
}

/**
 * Applies a player's request. `seq` must match the room's, so a click that
 * raced a state change is rejected instead of applied to the wrong state.
 */
export function applyRequest(room: Room, playerId: string, seq: number, action: ActionRequest, now: number, dice: Dice): Room {
  if (!room.game || room.status !== "playing") throw new RoomError("No hay una partida en curso");
  if (seq !== room.seq) throw new RoomError("La mesa cambió; mirá de nuevo");
  const allowed = allowedPlayerFor(room.game, action);
  if (allowed !== playerId) throw new RoomError(allowed === null ? "Ahora no se puede hacer eso" : "No es tu turno");
  const game = applyActionRequest(room.game, action, dice);
  return afterChange(room, game, action.type, playerId, now);
}

/** Runs the phase's default when the clock has run out; returns the room unchanged otherwise. */
export function fireDeadline(room: Room, now: number, dice: Dice): Room {
  if (!room.game || room.status !== "playing" || room.deadline === null || now < room.deadline) return room;
  const action = defaultAction(room.game);
  if (!action) return { ...room, deadline: null };
  const actorId = allowedPlayerFor(room.game, action);
  const game = room.game.phase.type === "awaitingPayment" ? autoResolveDebt(room.game) : applyActionRequest(room.game, action, dice);
  if (game === room.game) return { ...room, deadline: now + 60_000 };
  return afterChange(room, game, action.type, actorId, now);
}

export function toView(room: Room, now: number): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map(({ playerId, name, color, connected }) => ({ playerId, name, color, connected })),
    game: room.game,
    seq: room.seq,
    lastAction: room.lastAction,
    lastActorId: room.lastActorId,
    deadline: room.deadline,
    shakingPlayerId: room.shakingPlayerId,
    now,
  };
}
