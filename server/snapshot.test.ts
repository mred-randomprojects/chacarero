import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP } from "../src/game";
import { createRoom, joinRoom, startGame } from "./room";
import { loadRooms, saveRooms } from "./snapshot";

const NOW = 1_000_000;
const MAX_AGE = 30 * 60_000;
const ana = { playerId: "ana-0001", name: "Ana" };
const beto = { playerId: "beto-0001", name: "Beto" };

function file(): string {
  return join(mkdtempSync(join(tmpdir(), "terrateniente-")), "rooms.json");
}

function playing() {
  return startGame(joinRoom(createRoom("ABCD", ana, NOW), beto, NOW), ana.playerId, DEFAULT_SETUP, NOW, () => 0.5);
}

describe("rooms across a restart", () => {
  it("brings a game back as it was, its clock paused while the server was down", () => {
    const path = file();
    const room = { ...playing(), shakingPlayerId: ana.playerId };
    const deadline = room.deadline;
    if (deadline === null) throw new Error("no clock");
    expect(saveRooms(path, [room], NOW + 1_000)).toBe(1);

    const [back, ...rest] = loadRooms(path, NOW + 13_000, MAX_AGE);
    expect(rest).toEqual([]);
    expect(back?.game).toEqual(room.game);
    expect(back?.seq).toBe(room.seq);
    expect(back?.deadline).toBe(deadline + 12_000);
    expect(back?.shakingPlayerId).toBeNull();
    // Offline until their client reconnects, and freshly seen so the lobby does not drop them.
    expect(back?.players.map((p) => [p.connected, p.lastSeen])).toEqual([[false, NOW + 13_000], [false, NOW + 13_000]]);
  });

  it("consumes the file, so a later crash cannot bring back old games", () => {
    const path = file();
    saveRooms(path, [playing()], NOW);
    expect(loadRooms(path, NOW, MAX_AGE)).toHaveLength(1);
    expect(existsSync(path)).toBe(false);
    expect(loadRooms(path, NOW, MAX_AGE)).toEqual([]);
  });

  it("ignores a stale, foreign or broken file", () => {
    const path = file();
    saveRooms(path, [playing()], NOW);
    expect(loadRooms(path, NOW + MAX_AGE + 1, MAX_AGE)).toEqual([]);
    writeFileSync(path, JSON.stringify({ version: 99, savedAt: NOW, rooms: [playing()] }));
    expect(loadRooms(path, NOW, MAX_AGE)).toEqual([]);
    writeFileSync(path, "{not json");
    expect(loadRooms(path, NOW, MAX_AGE)).toEqual([]);
    writeFileSync(path, JSON.stringify({ version: 1, savedAt: NOW, rooms: [{ nope: true }, playing()] }));
    expect(loadRooms(path, NOW, MAX_AGE).map((r) => r.code)).toEqual(["ABCD"]);
  });
});
