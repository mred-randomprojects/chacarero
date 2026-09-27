/**
 * Rooms survive a restart: the server writes them to a file when it is asked
 * to stop (a deploy) and reads them back on start. Rooms live in memory
 * otherwise, so without this every deploy would end every game.
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import type { Room } from "./room";
import { resumeRoom } from "./room";

const VERSION = 1;

interface Snapshot {
  readonly version: number;
  readonly savedAt: number;
  readonly rooms: readonly Room[];
}

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || !("savedAt" in value) || !("rooms" in value)) return false;
  return value.version === VERSION && typeof value.savedAt === "number" && Array.isArray(value.rooms);
}

function looksLikeRoom(value: unknown): value is Room {
  if (typeof value !== "object" || value === null) return false;
  if (!("code" in value) || !("status" in value) || !("players" in value)) return false;
  return typeof value.code === "string" && typeof value.status === "string" && Array.isArray(value.players);
}

/** Writes atomically (temp file, then rename) so a kill mid-write keeps the previous file. */
export function saveRooms(path: string, rooms: Iterable<Room>, now: number): number {
  const snapshot: Snapshot = { version: VERSION, savedAt: now, rooms: [...rooms] };
  const temp = `${path}.tmp`;
  writeFileSync(temp, JSON.stringify(snapshot));
  renameSync(temp, path);
  return snapshot.rooms.length;
}

/**
 * The saved rooms, resumed; none when there is no file, it cannot be read, or
 * it is older than `maxAgeMs`. The file is consumed, so a later crash (which
 * saves nothing) never brings back games from an earlier stop.
 */
export function loadRooms(path: string, now: number, maxAgeMs: number): Room[] {
  if (!existsSync(path)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isSnapshot(parsed) || now - parsed.savedAt > maxAgeMs) return [];
    return parsed.rooms.filter(looksLikeRoom).map((room) => resumeRoom(room, parsed.savedAt, now));
  } catch (error) {
    console.warn("could not read saved rooms", error);
    return [];
  } finally {
    rmSync(path, { force: true });
  }
}
