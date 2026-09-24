import { describe, expect, it } from "vitest";
import { DECISION_SECONDS, DEFAULT_SETUP } from "../src/game";
import { parseClientMessage } from "../src/net/protocol";
import type { Room } from "./room";
import {
  COMPOSING_GRACE_MS,
  RoomError,
  applyRequest,
  chooseToken,
  createRoom,
  fireDeadline,
  generateCode,
  isAbandoned,
  joinRoom,
  leaveRoom,
  markDisconnected,
  newGame,
  pruneIdle,
  setComposing,
  setShaking,
  startGame,
  toView,
} from "./room";

const NOW = 1_000_000;
const DECISION_MS = DECISION_SECONDS * 1000;
const ana = { playerId: "ana-0001", name: "Ana" };
const beto = { playerId: "beto-0001", name: "Beto" };

function lobby() {
  return joinRoom(createRoom("ABCD", ana, NOW), beto, NOW);
}

/** A started room, with the opening roll already decided so Ana rolls first. */
function playing(): Room {
  const room = startGame(lobby(), ana.playerId, { ...DEFAULT_SETUP, startingCash: 35_000, dealDeeds: 0 }, NOW, () => 0.5);
  if (!room.game) throw new Error("no game");
  return { ...room, game: { ...room.game, phase: { type: "awaitingRoll" } } };
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
    expect(room.players[1]?.token).not.toBe(room.players[0]?.token);
    expect(room.players[1]?.color).not.toBe(room.players[0]?.color);
    room = markDisconnected(room, beto.playerId, NOW + 1);
    expect(room.players[1]?.connected).toBe(false);
    room = joinRoom(room, { ...beto, name: "Beto II" }, NOW + 2);
    expect(room.players).toHaveLength(2);
    expect(room.players[1]).toMatchObject({ connected: true, name: "Beto II" });
    for (let i = 0; i < 4; i++) room = joinRoom(room, { playerId: `p${i}-00000`, name: `P${i}` }, NOW);
    expect(() => joinRoom(room, { playerId: "late-0001", name: "Late" }, NOW)).toThrow(RoomError);
  });

  it("lets a player pick a free token and refuses a taken one", () => {
    let room = lobby();
    room = chooseToken(room, beto.playerId, "gallo", NOW);
    expect(room.players[1]).toMatchObject({ token: "gallo", color: "#f59e0b" });
    expect(() => chooseToken(room, ana.playerId, "gallo", NOW)).toThrow(RoomError);
    // Re-picking your own token is a no-op, not an error.
    expect(chooseToken(room, beto.playerId, "gallo", NOW).players[1]?.token).toBe("gallo");
    expect(() => chooseToken(playing(), ana.playerId, "gallo", NOW)).toThrow(RoomError);
    const game = startGame(room, ana.playerId, { ...DEFAULT_SETUP, startingCash: 35_000, dealDeeds: 0 }, NOW, () => 0.5).game;
    expect(game?.players.map((p) => p.token)).toEqual(["tractor", "gallo"]);
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
    expect(() => startGame(lobby(), beto.playerId, { ...DEFAULT_SETUP, startingCash: 35_000, dealDeeds: 0 }, NOW)).toThrow(/anfitrión/);
    expect(() => startGame(createRoom("ABCD", ana, NOW), ana.playerId, { ...DEFAULT_SETUP, startingCash: 35_000, dealDeeds: 0 }, NOW)).toThrow(/2 jugadores/);
    const room = playing();
    expect(room.status).toBe("playing");
    expect(room.game?.players.map((p) => p.id)).toEqual([ana.playerId, beto.playerId]);
    expect(room.seq).toBe(1);
    expect(room.deadline).toBe(NOW + DECISION_MS);
  });
});

describe("table clock", () => {
  it("starts the game with the host's clocks and times the dice with the roll clock", () => {
    let room = startGame(lobby(), ana.playerId, { ...DEFAULT_SETUP, decisionSeconds: 10, rollSeconds: 5 }, NOW, () => 0.5);
    expect(room.game?.clock).toEqual({ decisionSeconds: 10, rollSeconds: 5 });
    expect(room.deadline).toBe(NOW + 5_000);
    // Nobody throws: when the bar fills, the table throws for them.
    room = fireDeadline(room, NOW + 5_000, [2, 3]);
    expect(room.lastAction).toBe("rollDice");
    expect(room.game?.phase).toMatchObject({ type: "openingRoll", rolls: { [ana.playerId]: 5 } });
  });

  it("gives old clients that send no clock the generous default", () => {
    const parsed = parseClientMessage(JSON.stringify({ type: "startGame", playerId: ana.playerId, startingCash: 35_000 }));
    expect(parsed).toMatchObject({ type: "startGame", decisionSeconds: DECISION_SECONDS, rollSeconds: null, dealDeeds: 0 });
  });
});

describe("dealt deeds", () => {
  it("hands each player the agreed number of deeds before the first roll", () => {
    const room = startGame(lobby(), ana.playerId, { ...DEFAULT_SETUP, startingCash: 50_000, dealDeeds: 3 }, NOW, () => 0.5);
    const holdings = Object.values(room.game?.holdings ?? {});
    expect(holdings).toHaveLength(6);
    expect(holdings.filter((h) => h.ownerId === ana.playerId)).toHaveLength(3);
    expect(holdings.filter((h) => h.ownerId === beto.playerId)).toHaveLength(3);
    expect(room.game?.players.every((p) => p.cash === 50_000)).toBe(true);
  });
});

describe("playing", () => {
  it("throws for who starts before the first turn, re-throwing ties", () => {
    let room = startGame(lobby(), ana.playerId, { ...DEFAULT_SETUP, startingCash: 35_000, dealDeeds: 0 }, NOW, () => 0.5);
    expect(room.game?.phase).toEqual({ type: "openingRoll", contenders: [ana.playerId, beto.playerId], rolls: {} });
    expect(() => applyRequest(room, beto.playerId, room.seq, { type: "rollDice" }, NOW, [1, 2])).toThrow(/turno/);
    room = applyRequest(room, ana.playerId, room.seq, { type: "rollDice" }, NOW, [2, 3]);
    expect(room.game?.phase).toMatchObject({ type: "openingRoll", rolls: { [ana.playerId]: 5 } });
    expect(room.game?.currentPlayerIndex).toBe(1);
    // Beto ties: both throw again, Ana first.
    room = applyRequest(room, beto.playerId, room.seq, { type: "rollDice" }, NOW, [1, 4]);
    expect(room.game?.phase).toEqual({ type: "openingRoll", contenders: [ana.playerId, beto.playerId], rolls: {} });
    expect(room.game?.currentPlayerIndex).toBe(0);
    // The clock fires the default (a throw) for absent players during the opening too.
    room = fireDeadline(room, room.deadline ?? 0, [1, 1]);
    expect(room.game?.phase).toMatchObject({ type: "openingRoll", rolls: { [ana.playerId]: 2 } });
    room = applyRequest(room, beto.playerId, room.seq, { type: "rollDice" }, NOW, [6, 6]);
    expect(room.game?.phase).toEqual({ type: "awaitingRoll" });
    expect(room.game?.currentPlayerIndex).toBe(1);
    expect(room.game?.events.at(-1)).toMatchObject({ type: "turn", playerId: beto.playerId });
    // A double in the opening is just a high throw: no extra turn.
    expect(room.game?.rollAgain).toBe(false);
    expect(room.game?.players[1]?.doublesThisTurn).toBe(0);
  });

  it("applies requests from the right player with the right seq", () => {
    let room = playing();
    expect(() => applyRequest(room, beto.playerId, 1, { type: "rollDice" }, NOW, [1, 2])).toThrow(/turno/);
    expect(() => applyRequest(room, ana.playerId, 0, { type: "rollDice" }, NOW, [1, 2])).toThrow(/cambió/);
    room = applyRequest(room, ana.playerId, 1, { type: "rollDice" }, NOW, [1, 2]);
    expect(room.seq).toBe(2);
    expect(room.lastAction).toBe("rollDice");
    expect(room.game?.phase).toEqual({ type: "awaitingMove" });
    // The clock waits for the replay (one log event, 2 s) before the decision time starts.
    expect(room.deadline).toBe(NOW + 2_000 + DECISION_MS);
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
    room = fireDeadline(room, NOW + DECISION_MS, [1, 2]);
    expect(room.game?.dice).toEqual([1, 2]);
    expect(room.lastAction).toBe("rollDice");
    expect(room.lastActorId).toBe(ana.playerId);
    room = fireDeadline(room, room.deadline ?? 0, [1, 2]);
    expect(room.game?.phase.type).toBe("awaitingBuyDecision");
    room = fireDeadline(room, room.deadline ?? 0, [1, 2]);
    expect(room.game?.phase.type).toBe("auction");
  });

  it("keeps the clock from deciding for a player who is at the trade screen", () => {
    let room = playing();
    room = setComposing(room, ana.playerId, true);
    const deadline = room.deadline ?? 0;
    room = fireDeadline(room, deadline, [1, 2]);
    expect(room.game?.phase).toEqual({ type: "awaitingRoll" });
    expect(room.deadline).toBe(deadline + COMPOSING_GRACE_MS);
    // Someone else composing does not hold Ana's clock.
    room = setComposing(setComposing(room, ana.playerId, false), beto.playerId, true);
    room = fireDeadline(room, room.deadline ?? 0, [1, 2]);
    expect(room.lastAction).toBe("rollDice");
    expect(room.composingPlayerId).toBeNull();
  });

  it("shares the trade being built with everyone, and only from the player who may propose it", () => {
    const base = playing();
    if (!base.game) throw new Error("no game");
    let room: Room = { ...base, game: { ...base.game, holdings: { "salta-sur": { ownerId: ana.playerId, chacras: 0, estancia: false, mortgaged: false } } } };
    const draft = { toId: beto.playerId, gives: { deeds: ["salta-sur" as const], cash: 0 }, receives: { deeds: [], cash: 500 }, counter: false };
    // Beto is not on turn: his draft is not shown (his clock flag is harmless).
    room = setComposing(room, beto.playerId, true, draft);
    expect(toView(room, NOW).tradeDraft).toBeNull();
    room = setComposing(room, ana.playerId, true, { ...draft, toId: null });
    expect(toView(room, NOW).tradeDraft).toEqual({ fromId: ana.playerId, toId: null, gives: draft.gives, receives: draft.receives, counter: false });
    room = setComposing(room, ana.playerId, true, draft);
    expect(room.tradeDraft?.toId).toBe(beto.playerId);
    // A plain "the screen is open" keeps the draft; the same message twice changes nothing to broadcast.
    const same = setComposing(room, ana.playerId, true);
    expect(same).toBe(room);
    // Proposing it (any change of the game) ends the draft; so does closing the screen.
    const proposed = applyRequest(room, ana.playerId, room.seq, { type: "proposeTrade", toId: beto.playerId, gives: draft.gives, receives: draft.receives }, NOW, [1, 2]);
    expect(proposed.tradeDraft).toBeNull();
    expect(setComposing(room, ana.playerId, false).tradeDraft).toBeNull();
    // Beto answers with a counter-offer: now Ana watches his.
    const counter = setComposing(proposed, beto.playerId, true, { toId: ana.playerId, gives: { deeds: [], cash: 0 }, receives: { deeds: [], cash: 900 }, counter: true });
    expect(counter.tradeDraft).toMatchObject({ fromId: beto.playerId, counter: true });
    expect(setComposing(proposed, beto.playerId, true, { ...draft, toId: ana.playerId, counter: false }).tradeDraft).toBeNull();
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
    // One log event to replay (2 s) plus the decision time to answer.
    expect(room.deadline).toBe(NOW + 2_000 + DECISION_MS);
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
