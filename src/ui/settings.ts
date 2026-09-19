/**
 * Per-device preferences, kept in localStorage. Everything has a sane default
 * so the game works with storage blocked.
 */
export interface Settings {
  /** How long each event banner stays on screen. */
  readonly bannerSeconds: number;
  /** Multiplier for every decision countdown (1 = defaults, 0 = no countdowns). */
  readonly countdownScale: number;
  readonly soundVolume: number;
  readonly muted: boolean;
  /** Fly to the seat of the player whose turn starts. */
  readonly followTurn: boolean;
  /** Track the pawn while it moves. */
  readonly followPawn: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  bannerSeconds: 3,
  countdownScale: 1,
  soundVolume: 0.8,
  muted: false,
  followTurn: true,
  followPawn: true,
};

const KEY = "chacarero.settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Loads saved settings, ignoring anything malformed. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_SETTINGS;
    const num = (key: keyof Settings, min: number, max: number): number => {
      const value = parsed[key];
      const fallback = DEFAULT_SETTINGS[key];
      return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : (fallback as number);
    };
    const bool = (key: keyof Settings): boolean => (typeof parsed[key] === "boolean" ? (parsed[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean));
    return {
      bannerSeconds: num("bannerSeconds", 1, 15),
      countdownScale: num("countdownScale", 0, 4),
      soundVolume: num("soundVolume", 0, 1),
      muted: bool("muted"),
      followTurn: bool("followTurn"),
      followPawn: bool("followPawn"),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage blocked; keep going with in-memory settings
  }
}
