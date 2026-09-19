/** A stable id for this browser, so a refresh reconnects as the same player. */
const KEY = "chacarero.playerId";
const NAME_KEY = "chacarero.name";
const ROOM_KEY = "chacarero.lastRoom";

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getPlayerId(): string {
  // `?jugador=algo` gives this tab its own identity, so one browser can sit at a table twice (testing).
  const override = new URLSearchParams(location.search).get("jugador");
  if (override) return `tab-${override}`.padEnd(8, "0").slice(0, 64);
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const created = randomId();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // storage blocked
  }
}

export function getLastRoom(): string | null {
  try {
    return localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

export function saveLastRoom(code: string | null): void {
  try {
    if (code) localStorage.setItem(ROOM_KEY, code);
    else localStorage.removeItem(ROOM_KEY);
  } catch {
    // storage blocked
  }
}

/** Invite link for a room, on whatever host this client is served from. */
export function inviteLink(code: string): string {
  const url = new URL(location.href);
  url.search = `?mesa=${code}`;
  url.hash = "";
  return url.toString();
}
