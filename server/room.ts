/**
 * Pure room logic: who is in a room, the game it holds, and the clock that
 * makes decisions for absent players. No sockets in here, so it is easy to
 * test; index.ts wires it to the network.
 */
import type { ActionRequest, GameSetup, GameState, TokenId } from "../src/game";
import { allowedPlayerFor, applyActionRequest, autoResolveDebt, createGame, defaultAction, firstFreeToken, getToken, phaseSeconds, replaySeconds } from "../src/game";
import type { Dice } from "../src/game";
import type { RoomPlayer, RoomStatus, RoomView, SharedTradeDraft, TradeDraftMessage } from "../src/net/protocol";

export const MAX_PLAYERS = 6;

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
  /** Player at the trade screen; the clock waits for them instead of deciding. */
  readonly composingPlayerId: string | null;
  /** The deal being put together at that screen, shown to everyone else. */
  readonly tradeDraft: SharedTradeDraft | null;
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
    players: [{ playerId: host.playerId, name: host.name, token: "tractor", color: getToken("tractor").color, connected: true, lastSeen: now }],
    game: null,
    seq: 0,
    lastAction: null,
    lastActorId: null,
    deadline: null,
    shakingPlayerId: null,
    composingPlayerId: null,
    tradeDraft: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** How much longer a player composing a trade gets each time their clock would have fired. */
export const COMPOSING_GRACE_MS = 30_000;

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
  const token = firstFreeToken(room.players.map((p) => p.token));
  if (!token) throw new RoomError("No quedan fichas libres");
  return touch({ ...room, players: [...room.players, { playerId: player.playerId, name: player.name, token, color: getToken(token).color, connected: true, lastSeen: now }] }, now);
}

/** A player picks their piece in the lobby; a piece someone else holds is refused. */
export function chooseToken(room: Room, playerId: string, token: TokenId, now: number): Room {
  if (room.status !== "lobby") throw new RoomError("La partida ya empezó");
  if (!room.players.some((p) => p.playerId === playerId)) return room;
  const holder = room.players.find((p) => p.token === token);
  if (holder && holder.playerId !== playerId) throw new RoomError(`${holder.name} ya tiene ${getToken(token).name.toLowerCase()}`);
  return touch(updatePlayerRecord(room, playerId, { token, color: getToken(token).color }), now);
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
  const game = createGame({ players: room.players.map((p) => ({ id: p.playerId, name: p.name, token: p.token })), ...setup, random });
  return touch(withClock({ ...room, status: "playing", game, seq: 1, lastAction: null, lastActorId: null, shakingPlayerId: null }, now), now);
}

/** Back to the lobby once a game is over (host only). */
export function newGame(room: Room, playerId: string, now: number): Room {
  if (room.hostId !== playerId) throw new RoomError("Solo el anfitrión puede volver a la sala");
  return touch({ ...room, status: "lobby", game: null, seq: 0, lastAction: null, lastActorId: null, deadline: null, shakingPlayerId: null, composingPlayerId: null, tradeDraft: null }, now);
}

/** Whether `playerId` may be putting this deal together: the proposer, or the player answering with a counter-offer. */
function mayDraft(game: GameState, playerId: string, draft: TradeDraftMessage): boolean {
  if (draft.toId !== null && (draft.toId === playerId || !game.players.some((p) => p.id === draft.toId && !p.bankrupt))) return false;
  if (draft.counter) return game.phase.type === "awaitingTradeResponse" && game.phase.trade.toId === playerId && draft.toId === game.phase.trade.fromId;
  return allowedPlayerFor(game, { type: "proposeTrade", toId: draft.toId ?? playerId, gives: draft.gives, receives: draft.receives }) === playerId;
}

/**
 * A player opened (or closed) the trade screen. The clock only cares about
 * the player it is waiting on; the draft, when there is one, is what every
 * other screen watches being built. Returns the same room when nothing
 * anyone sees changed, so the server need not broadcast.
 */
export function setComposing(room: Room, playerId: string, composing: boolean, draft?: TradeDraftMessage): Room {
  if (!room.game) return room;
  if (!composing) {
    if (room.composingPlayerId !== playerId && room.tradeDraft?.fromId !== playerId) return room;
    return { ...room, composingPlayerId: room.composingPlayerId === playerId ? null : room.composingPlayerId, tradeDraft: room.tradeDraft?.fromId === playerId ? null : room.tradeDraft };
  }
  // No draft (the screen only said it is open, e.g. reviewing a proposal): what everyone watches stays as it is.
  const tradeDraft = draft === undefined ? room.tradeDraft : mayDraft(room.game, playerId, draft) ? { fromId: playerId, ...draft } : room.tradeDraft?.fromId === playerId ? null : room.tradeDraft;
  if (room.composingPlayerId === playerId && tradeDraft === room.tradeDraft) return room;
  return { ...room, composingPlayerId: playerId, tradeDraft };
}

export function setShaking(room: Room, playerId: string, shaking: boolean): Room {
  if (!room.game) return room;
  if (allowedPlayerFor(room.game, { type: "rollDice" }) !== playerId) return room;
  return { ...room, shakingPlayerId: shaking ? playerId : null };
}

function afterChange(room: Room, game: GameState, action: ActionRequest["type"], actorId: string | null, now: number): Room {
  const status: RoomStatus = game.phase.type === "gameOver" ? "finished" : "playing";
  return touch(withClock({ ...room, game, status, seq: room.seq + 1, lastAction: action, lastActorId: actorId, shakingPlayerId: null, composingPlayerId: null, tradeDraft: null }, now), now);
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
  // Someone at the trade screen is not absent: give them a little longer rather than deciding for them.
  if (actorId !== null && actorId === room.composingPlayerId) return { ...room, deadline: now + COMPOSING_GRACE_MS };
  const game = room.game.phase.type === "awaitingPayment" ? autoResolveDebt(room.game) : applyActionRequest(room.game, action, dice);
  if (game === room.game) return { ...room, deadline: now + 60_000 };
  return afterChange(room, game, action.type, actorId, now);
}

export function toView(room: Room, now: number): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map(({ playerId, name, token, color, connected }) => ({ playerId, name, token, color, connected })),
    game: room.game,
    seq: room.seq,
    lastAction: room.lastAction,
    lastActorId: room.lastActorId,
    deadline: room.deadline,
    shakingPlayerId: room.shakingPlayerId,
    tradeDraft: room.tradeDraft,
    now,
  };
}
