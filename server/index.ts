/**
 * Chacarero room server: one Bun process that serves the built client and
 * hosts the WebSocket rooms. Run with `bun run server/index.ts`.
 *
 * Every room change is broadcast whole to its players (no diffs), and a
 * quarter-second ticker fires expired decision clocks and cleans up rooms.
 */
import type { ServerWebSocket } from "bun";
import type { Dice } from "../src/game";
import type { ClientMessage, ServerMessage } from "../src/net/protocol";
import { parseClientMessage } from "../src/net/protocol";
import type { Room } from "./room";
import {
  RoomError,
  applyRequest,
  chooseToken,
  createRoom,
  fireDeadline,
  generateCode,
  heartbeat,
  isAbandoned,
  joinRoom,
  leaveRoom,
  markDisconnected,
  newGame,
  pruneIdle,
  renamePlayer,
  setShaking,
  startGame,
  toView,
} from "./room";

const PORT = Number(process.env.PORT ?? 9902);
const STATIC_DIR = process.env.STATIC_DIR ?? "dist";
const BASE_PATH = "/chacarero";
const LOBBY_IDLE_MS = 60_000;
const ROOM_ABANDONED_MS = 30 * 60_000;
const TICK_MS = 250;
const MAX_ROOMS = 500;

interface SocketData {
  playerId: string | null;
  code: string | null;
}

type Socket = ServerWebSocket<SocketData>;

const rooms = new Map<string, Room>();
const socketsByRoom = new Map<string, Set<Socket>>();

function rollDice(): Dice {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return [1 + ((bytes[0] ?? 0) % 6), 1 + ((bytes[1] ?? 0) % 6)];
}

function send(ws: Socket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.warn("send failed", error);
  }
}

function broadcast(room: Room): void {
  const now = Date.now();
  const view = toView(room, now);
  for (const ws of socketsByRoom.get(room.code) ?? []) {
    if (ws.data.playerId) send(ws, { type: "room", you: ws.data.playerId, room: view });
  }
}

function attach(ws: Socket, code: string, playerId: string): void {
  detach(ws);
  ws.data.code = code;
  ws.data.playerId = playerId;
  let set = socketsByRoom.get(code);
  if (!set) {
    set = new Set();
    socketsByRoom.set(code, set);
  }
  set.add(ws);
}

function detach(ws: Socket): void {
  const { code } = ws.data;
  if (!code) return;
  socketsByRoom.get(code)?.delete(ws);
  ws.data.code = null;
}

/** Runs a room update, broadcasting the result or reporting the rule violation to the sender. */
function update(ws: Socket, code: string, change: (room: Room) => Room): void {
  const room = rooms.get(code);
  if (!room) {
    send(ws, { type: "roomNotFound", code });
    return;
  }
  try {
    const next = change(room);
    if (next === room) return;
    rooms.set(code, next);
    broadcast(next);
  } catch (error) {
    if (error instanceof RoomError) send(ws, { type: "error", message: error.message });
    else {
      console.error("room update failed", error);
      send(ws, { type: "error", message: error instanceof Error ? error.message : "Error inesperado" });
    }
  }
}

function handle(ws: Socket, message: ClientMessage): void {
  const now = Date.now();
  switch (message.type) {
    case "createRoom": {
      if (rooms.size >= MAX_ROOMS) {
        send(ws, { type: "error", message: "Demasiadas mesas abiertas; probá más tarde" });
        return;
      }
      let code = generateCode();
      while (rooms.has(code)) code = generateCode();
      const room = createRoom(code, { playerId: message.playerId, name: message.name }, now);
      rooms.set(code, room);
      attach(ws, code, message.playerId);
      broadcast(room);
      return;
    }
    case "join": {
      const room = rooms.get(message.code);
      if (!room) {
        send(ws, { type: "roomNotFound", code: message.code });
        return;
      }
      try {
        const next = joinRoom(room, { playerId: message.playerId, name: message.name }, now);
        rooms.set(room.code, next);
        attach(ws, room.code, message.playerId);
        broadcast(next);
      } catch (error) {
        send(ws, { type: "error", message: error instanceof RoomError ? error.message : "No se pudo entrar" });
      }
      return;
    }
    case "leave": {
      const code = ws.data.code;
      if (!code) return;
      update(ws, code, (room) => leaveRoom(room, message.playerId, now));
      detach(ws);
      send(ws, { type: "left" });
      return;
    }
    case "updateName":
      if (ws.data.code) update(ws, ws.data.code, (room) => renamePlayer(room, message.playerId, message.name, now));
      return;
    case "chooseToken":
      if (ws.data.code) update(ws, ws.data.code, (room) => chooseToken(room, message.playerId, message.token, now));
      return;
    case "startGame":
      if (ws.data.code) update(ws, ws.data.code, (room) => startGame(room, message.playerId, { startingCash: message.startingCash, dealDeeds: message.dealDeeds }, now));
      return;
    case "newGame":
      if (ws.data.code) update(ws, ws.data.code, (room) => newGame(room, message.playerId, now));
      return;
    case "shake":
      if (ws.data.code) update(ws, ws.data.code, (room) => setShaking(room, message.playerId, message.shaking));
      return;
    case "action":
      if (ws.data.code) update(ws, ws.data.code, (room) => applyRequest(room, message.playerId, message.seq, message.action, now, rollDice()));
      return;
    case "heartbeat": {
      const code = ws.data.code;
      const room = code ? rooms.get(code) : undefined;
      if (room) rooms.set(room.code, heartbeat(room, message.playerId, now));
      return;
    }
  }
}

/** Fires expired clocks and forgets dead rooms. */
function tick(): void {
  const now = Date.now();
  for (const [code, room] of rooms) {
    let next = fireDeadline(room, now, rollDice());
    next = pruneIdle(next, now, LOBBY_IDLE_MS);
    if (next !== room) {
      rooms.set(code, next);
      broadcast(next);
    }
    if (isAbandoned(next, now, ROOM_ABANDONED_MS)) {
      rooms.delete(code);
      socketsByRoom.delete(code);
      console.log(`room ${code} closed (abandoned)`);
    }
  }
}

setInterval(tick, TICK_MS);

const server = Bun.serve<SocketData>({
  port: PORT,
  async fetch(request, srv): Promise<Response | undefined> {
    const url = new URL(request.url);
    if (url.pathname === "/ws" || url.pathname === `${BASE_PATH}/ws`) {
      const upgraded = srv.upgrade(request, { data: { playerId: null, code: null } });
      return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }
    if (url.pathname === "/health" || url.pathname === `${BASE_PATH}/health`) return Response.json({ ok: true, rooms: rooms.size });
    // Static client, built into dist/ with the /chacarero/ base path.
    if (!url.pathname.startsWith(BASE_PATH)) return Response.redirect(`${BASE_PATH}/`, 302);
    const path = url.pathname.slice(BASE_PATH.length);
    const index = () => new Response(Bun.file(`${STATIC_DIR}/index.html`), { headers: { "content-type": "text/html; charset=utf-8" } });
    if (path === "" || path === "/") return index();
    const file = Bun.file(`${STATIC_DIR}${path}`);
    if (await file.exists()) return new Response(file);
    return index();
  },
  websocket: {
    open() {
      // Nothing until the client says who it is.
    },
    message(ws, raw) {
      const message = parseClientMessage(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      if (!message) {
        send(ws, { type: "error", message: "Mensaje inválido" });
        return;
      }
      handle(ws, message);
    },
    close(ws) {
      const { code, playerId } = ws.data;
      detach(ws);
      if (!code || !playerId) return;
      const room = rooms.get(code);
      if (!room) return;
      // Only mark offline if this was their last socket (a refresh opens a new one first).
      const stillConnected = [...(socketsByRoom.get(code) ?? [])].some((s) => s.data.playerId === playerId);
      if (stillConnected) return;
      const next = markDisconnected(room, playerId, Date.now());
      rooms.set(code, next);
      broadcast(next);
    },
  },
});

console.log(`Chacarero server listening on http://localhost:${server.port} (static: ${STATIC_DIR})`);
