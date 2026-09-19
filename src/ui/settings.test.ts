import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    store,
  };
}

describe("settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to defaults without storage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips and clamps", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    saveSettings({ ...DEFAULT_SETTINGS, bannerSeconds: 8, muted: true });
    expect(loadSettings()).toMatchObject({ bannerSeconds: 8, muted: true });
    storage.setItem("chacarero.settings", JSON.stringify({ bannerSeconds: 99, soundVolume: -2, followTurn: "yes" }));
    const loaded = loadSettings();
    expect(loaded.bannerSeconds).toBe(15);
    expect(loaded.soundVolume).toBe(0);
    expect(loaded.followTurn).toBe(true);
  });

  it("ignores garbage", () => {
    vi.stubGlobal("localStorage", fakeStorage({ "chacarero.settings": "{not json" }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
