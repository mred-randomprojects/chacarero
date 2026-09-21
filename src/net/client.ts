import type { ActionRequest, GameSetup, TokenId } from "../game";
import type { ClientMessage, RoomView, ServerMessage } from "./protocol";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface RoomClientEvents {
  readonly onRoom: (room: RoomView, you: string) => void;
  readonly onError: (message: string) => void;
  readonly onRoomNotFound: (code: string) => void;
  readonly onLeft: () => void;
  readonly onStatus: (status: ConnectionStatus) => void;
}

const HEARTBEAT_MS = 15_000;
const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 8_000;

/**
 * Where the room server lives. Set at build time for hosted clients; in
 * development it is the local server; a static host without a server has
 * none and online play is disabled.
 */
export function defaultServerUrl(): string | null {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return configured;
  if (typeof location === "undefined") return null;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "ws://localhost:9902/ws";
  if (location.hostname.endsWith("github.io")) return null;
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}${import.meta.env.BASE_URL}ws`;
}

/**
 * One WebSocket to the room server, with heartbeats and reconnection. After
 * a reconnect it re-joins the last room so a refresh mid-game just works.
 */
export class RoomClient {
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closedByUser = false;
  private rejoin: { code: string; name: string } | null = null;

  constructor(
    private readonly url: string,
    private readonly playerId: string,
    private readonly events: RoomClientEvents,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  /** Creates a room; the server answers with the room view. */
  createRoom(name: string): void {
    this.rejoin = null;
    this.send({ type: "createRoom", playerId: this.playerId, name });
  }

  join(code: string, name: string): void {
    this.rejoin = { code, name };
    this.send({ type: "join", playerId: this.playerId, name, code });
  }

  leave(): void {
    this.rejoin = null;
    this.send({ type: "leave", playerId: this.playerId });
  }

  updateName(name: string): void {
    if (this.rejoin) this.rejoin = { ...this.rejoin, name };
    this.send({ type: "updateName", playerId: this.playerId, name });
  }

  chooseToken(token: TokenId): void {
    this.send({ type: "chooseToken", playerId: this.playerId, token });
  }

  startGame(setup: GameSetup): void {
    this.send({ type: "startGame", playerId: this.playerId, ...setup });
  }

  newGame(): void {
    this.send({ type: "newGame", playerId: this.playerId });
  }

  shake(shaking: boolean): void {
    this.send({ type: "shake", playerId: this.playerId, shaking });
  }

  action(seq: number, action: ActionRequest): void {
    this.send({ type: "action", playerId: this.playerId, seq, action });
  }

  /** Remembers the room to re-join after a reconnect (e.g. when created rather than joined). */
  remember(code: string, name: string): void {
    this.rejoin = { code, name };
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }

  private open(): void {
    this.events.onStatus("connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.events.onStatus("open");
      this.startHeartbeat();
      if (this.rejoin) this.send({ type: "join", playerId: this.playerId, name: this.rejoin.name, code: this.rejoin.code });
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      switch (message.type) {
        case "room":
          this.events.onRoom(message.room, message.you);
          return;
        case "error":
          this.events.onError(message.message);
          return;
        case "roomNotFound":
          this.rejoin = null;
          this.events.onRoomNotFound(message.code);
          return;
        case "left":
          this.events.onLeft();
          return;
      }
    };
    socket.onclose = () => {
      this.stopHeartbeat();
      this.socket = null;
      this.events.onStatus("closed");
      if (!this.closedByUser) this.scheduleReconnect();
    };
    socket.onerror = () => {
      // onclose follows and handles reconnection.
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.attempts);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.send({ type: "heartbeat", playerId: this.playerId }), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private send(message: ClientMessage): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.events.onError("Sin conexión con la mesa; reintentando…");
      return;
    }
    socket.send(JSON.stringify(message));
  }
}
