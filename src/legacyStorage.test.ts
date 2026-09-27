import { describe, expect, it } from "vitest";
import { migrateLegacyStorage } from "./legacyStorage";

function fakeStorage(initial: Record<string, string>): Storage & { readonly entries: () => Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
    entries: () => Object.fromEntries(data),
  };
}

describe("storage saved under the old name", () => {
  it("moves to the current keys", () => {
    const storage = fakeStorage({ "chacarero.playerId": "abc12345", "chacarero.settings": "{\"muted\":true}", "other.app": "x" });
    migrateLegacyStorage(storage);
    expect(storage.entries()).toEqual({ "terrateniente.playerId": "abc12345", "terrateniente.settings": "{\"muted\":true}", "other.app": "x" });
  });

  it("never overwrites a value saved under the current key", () => {
    const storage = fakeStorage({ "chacarero.name": "Viejo", "terrateniente.name": "Nuevo" });
    migrateLegacyStorage(storage);
    expect(storage.entries()).toEqual({ "terrateniente.name": "Nuevo" });
  });
});
