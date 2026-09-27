/**
 * Until September 2026 the game saved under "chacarero.*" keys. Moves what a
 * browser still has there to the current keys (never over a newer value), so
 * a returning player keeps their id, name, last table and settings.
 */
const LEGACY_PREFIX = "chacarero.";
const PREFIX = "terrateniente.";
const KEYS = ["playerId", "name", "lastRoom", "settings"] as const;

export function migrateLegacyStorage(storage: Storage): void {
  try {
    for (const key of KEYS) {
      const old = storage.getItem(LEGACY_PREFIX + key);
      if (old === null) continue;
      if (storage.getItem(PREFIX + key) === null) storage.setItem(PREFIX + key, old);
      storage.removeItem(LEGACY_PREFIX + key);
    }
  } catch {
    // storage blocked: nothing to carry over
  }
}
