import { describe, expect, it } from "vitest";
import {
  RoomError,
  applyRequest,
  createRoom,
  fireDeadline,
  generateCode,
  isAbandoned,
  joinRoom,
  leaveRoom,
  markDisconnected,
  newGame,
  pruneIdle,
  setShaking,
  startGame,
  toView,
} from "./room";

const NOW = 1_000_000;
const ana = { playerId: "ana-0001", name: "Ana" };
const beto = { playerId: "beto-0001", name: "Beto" };

function lobby() {
  return joinRoom(createRoom("ABCD", ana, NOW), beto, NOW);
}

function playing() {
  return startGame(lobby(), ana.playerId, { startingCash: 35_000, dealDeeds: 0 }, NOW, () => 0.5);
}

describe("lobby", () => {
  it("generates four-letter codes without confusable characters", () => {
    const code = generateCode(() => 0.999);
    expect(code).toHaveLength(4);
    expect(code).not.toMatch(/[IO01]/);
  });

  it("joins, reconnects and caps at six", () => {
    let room = lobby();
    expect(room.players).toHaveLength(2);
    expect(room.players[1]?.color).not.toBe(room.players[0]?.color);
    room = markDisconnected(room, beto.playerId, NOW + 1);
    expect(room.players[1]?.connected).toBe(false);
    room = joinRoom(room, { ...beto, name: "Beto II" }, NOW + 2);
    expect(room.players).toHaveLength(2);
    expect(room.players[1]).toMatchObject({ connected: true, name: "Beto II" });
    for (let i = 0; i < 4; i++) room = joinRoom(room, { playerId: `p${i}-00000`, name: `P${i}` }, NOW);
    expect(() => joinRoom(room, { playerId: "late-0001", name: "Late" }, NOW)).toThrow(RoomError);
  });

  it("passes the host on when the host leaves the lobby", () => {
    const room = leaveRoom(lobby(), ana.playerId, NOW);
    expect(room.players.map((p) => p.playerId)).toEqual([beto.playerId]);
    expect(room.hostId).toBe(beto.playerId);
  });

  it("prunes idle lobby players and detects abandoned rooms", () => {
    let room = markDisconnected(lobby(), beto.playerId, NOW);
    expect(pruneIdle(room, NOW + 10_000, 60_000).players).toHaveLength(2);
    room = pruneIdle(room, NOW + 70_000, 60_000);
    expect(room.players).toHaveLength(1);
    room = markDisconnected(room, ana.playerId, NOW);
    expect(isAbandoned(room, NOW + 1, 60_000)).toBe(false);
    expect(isAbandoned(room, NOW + 61_000, 60_000)).toBe(true);
  });

  it("only the host starts, with at least two players", () => {
    expect(() => startGame(lobby(), beto.playerId, { startingCash: 35_000, dealDeeds: 0 }, NOW)).toThrow(/anfitrión/);
    expect(() => startGame(createRoom("ABCD", ana, NOW), ana.playerId, { startingCash: 35_000, dealDeeds: 0 }, NOW)).toThrow(/2 jugadores/);
    const room = playing();
    expect(room.status).toBe("playing");
    expect(room.game?.players.map((p) => p.id)).toEqual([ana.playerId, beto.playerId]);
    expect(room.seq).toBe(1);
    expect(room.deadline).toBe(NOW + 30_000);
  });
});

describe("dealt deeds", () => {
  it("hands each player the agreed number of deeds before the first roll", () => {
    const room = startGame(lobby(), ana.playerId, { startingCash: 50_000, dealDeeds: 3 }, NOW, () => 0.5);
    const holdings = Object.values(room.game?.holdings ?? {});
    expect(holdings).toHaveLength(6);
    expect(holdings.filter((h) => h.ownerId === ana.playerId)).toHaveLength(3);
    expect(holdings.filter((h) => h.ownerId === beto.playerId)).toHaveLength(3);
    expect(room.game?.players.every((p) => p.cash === 50_000)).toBe(true);
  });
});

describe("playing", () => {
  it("applies requests from the right player with the right seq", () => {
    let room = playing();
    expect(() => applyRequest(room, beto.playerId, 1, { type: "rollDice" }, NOW, [1, 2])).toThrow(/turno/);
    expect(() => applyRequest(room, ana.playerId, 0, { type: "rollDice" }, NOW, [1, 2])).toThrow(/cambió/);
    room = applyRequest(room, ana.playerId, 1, { type: "rollDice" }, NOW, [1, 2]);
    expect(room.seq).toBe(2);
    expect(room.lastAction).toBe("rollDice");
    expect(room.game?.phase).toEqual({ type: "awaitingMove" });
    // The clock waits for the replay (one log event, 2 s) plus the 5 s move window.
    expect(room.deadline).toBe(NOW + 7_000);
    room = applyRequest(room, ana.playerId, 2, { type: "movePawn" }, NOW, [1, 2]);
    expect(room.game?.phase).toEqual({ type: "awaitingBuyDecision", deedId: "formosa-norte" });
  });

  it("clears shaking when the dice are thrown and ignores shaking from the wrong player", () => {
    let room = playing();
    expect(setShaking(room, beto.playerId, true).shakingPlayerId).toBeNull();
    room = setShaking(room, ana.playerId, true);
    expect(room.shakingPlayerId).toBe(ana.playerId);
    room = applyRequest(room, ana.playerId, 1, { type: "rollDice" }, NOW, [1, 2]);
    expect(room.shakingPlayerId).toBeNull();
  });

  it("fires the default when the deadline passes", () => {
    let room = playing();
    expect(fireDeadline(room, NOW + 1_000, [1, 2])).toBe(room);
    room = fireDeadline(room, NOW + 30_000, [1, 2]);
    expect(room.game?.dice).toEqual([1, 2]);
    expect(room.lastAction).toBe("rollDice");
    expect(room.lastActorId).toBe(ana.playerId);
    room = fireDeadline(room, room.deadline ?? 0, [1, 2]);
    expect(room.game?.phase.type).toBe("awaitingBuyDecision");
    room = fireDeadline(room, room.deadline ?? 0, [1, 2]);
    expect(room.game?.phase.type).toBe("auction");
  });

  it("rejects a trade for an absent responder when its clock runs out", () => {
    let room = playing();
    const game = room.game;
    if (!game) throw new Error("no game");
    room = { ...room, game: { ...game, phase: { type: "turnEnd" }, holdings: { "salta-sur": { ownerId: ana.playerId, chacras: 0, estancia: false, mortgaged: false } } } };
    const propose = { type: "proposeTrade", toId: beto.playerId, gives: { deeds: ["salta-sur"], cash: 0 }, receives: { deeds: [], cash: 1_000 } } as const;
    expect(() => applyRequest(room, beto.playerId, room.seq, propose, NOW, [1, 2])).toThrow(/turno/);
    room = applyRequest(room, ana.playerId, room.seq, propose, NOW, [1, 2]);
    expect(room.game?.phase.type).toBe("awaitingTradeResponse");
    // One log event to replay (2 s) plus the 45 s to answer.
    expect(room.deadline).toBe(NOW + 47_000);
    expect(() => applyRequest(room, ana.playerId, room.seq, { type: "acceptTrade" }, NOW, [1, 2])).toThrow(/turno/);
    expect(() => applyRequest(room, beto.playerId, room.seq, { type: "cancelTrade" }, NOW, [1, 2])).toThrow(/turno/);
    room = fireDeadline(room, room.deadline ?? 0, [1, 2]);
    expect(room.lastAction).toBe("rejectTrade");
    expect(room.lastActorId).toBe(beto.playerId);
    expect(room.game?.phase).toEqual({ type: "turnEnd" });
    expect(room.game?.holdings["salta-sur"]?.ownerId).toBe(ana.playerId);
  });

  it("ends the game and lets the host go back to the lobby", () => {
    let room = playing();
    const game = room.game;
    if (!game) throw new Error("no game");
    room = { ...room, game: { ...game, phase: { type: "gameOver", winnerId: ana.playerId } }, status: "finished" };
    expect(() => newGame(room, beto.playerId, NOW)).toThrow(RoomError);
    room = newGame(room, ana.playerId, NOW);
    expect(room.status).toBe("lobby");
    expect(room.game).toBeNull();
    expect(toView(room, NOW).players).toHaveLength(2);
  });
});
