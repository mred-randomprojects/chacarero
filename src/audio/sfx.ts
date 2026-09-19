/**
 * Sound effects. Samples are CC0 from Kenney (see public/sounds/LICENSE.txt),
 * decoded lazily through the Web Audio API so the first user gesture can
 * unlock the context. Every sound has a few variants picked at random so
 * repeated events do not sound mechanical.
 */

export type SoundName =
  | "diceGrab"
  | "diceShake"
  | "diceThrow"
  | "dieLand"
  | "hop"
  | "cardDraw"
  | "deedBuy"
  | "cash"
  | "cashBig"
  | "build"
  | "sellBuilding"
  | "mortgage"
  | "unmortgage"
  | "jail"
  | "gavelTap"
  | "gavelBang"
  | "auctionWon"
  | "turn"
  | "error"
  | "open"
  | "close"
  | "bankrupt"
  | "win";

const LIBRARY: Readonly<Record<SoundName, readonly string[]>> = {
  diceGrab: ["dice-grab-1.ogg", "dice-grab-2.ogg"],
  diceShake: ["dice-shake-1.ogg", "dice-shake-2.ogg", "dice-shake-3.ogg"],
  diceThrow: ["dice-throw-1.ogg", "dice-throw-2.ogg", "dice-throw-3.ogg"],
  dieLand: ["die-throw-1.ogg", "die-throw-2.ogg", "die-throw-3.ogg", "die-throw-4.ogg"],
  hop: ["footstep_wood_000.ogg", "footstep_wood_001.ogg", "footstep_wood_002.ogg", "footstep_wood_003.ogg", "footstep_wood_004.ogg"],
  cardDraw: ["card-slide-1.ogg", "card-slide-2.ogg", "card-slide-3.ogg", "cards-pack-take-out-1.ogg"],
  deedBuy: ["card-place-1.ogg", "card-place-2.ogg", "card-place-3.ogg"],
  cash: ["chips-handle-1.ogg", "chips-handle-2.ogg", "chips-handle-3.ogg", "chips-collide-1.ogg", "chips-collide-2.ogg"],
  cashBig: ["chips-stack-1.ogg", "chips-stack-2.ogg", "chips-stack-3.ogg"],
  build: ["impactWood_light_000.ogg", "impactWood_light_001.ogg", "impactWood_light_002.ogg"],
  sellBuilding: ["impactSoft_medium_000.ogg"],
  mortgage: ["impactPlank_medium_000.ogg"],
  unmortgage: ["confirmation_002.ogg"],
  jail: ["impactMetal_heavy_000.ogg"],
  gavelTap: ["impactWood_medium_000.ogg", "impactWood_medium_001.ogg"],
  gavelBang: ["impactWood_heavy_000.ogg"],
  auctionWon: ["jingles_PIZZI10.ogg"],
  turn: ["jingles_PIZZI08.ogg"],
  error: ["error_004.ogg"],
  open: ["open_001.ogg"],
  close: ["close_001.ogg"],
  bankrupt: ["jingles_SAX01.ogg", "jingles_PIZZI16.ogg"],
  win: ["jingles_SAX02.ogg"],
};

export interface PlayOptions {
  /** 0-1, relative to the master volume. */
  readonly volume?: number;
  /** Playback rate; 1 = as recorded. */
  readonly rate?: number;
}

export interface SoundHandle {
  stop(): void;
}

class Sfx {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private volume = 0.8;
  private muted = false;
  private base = `${import.meta.env.BASE_URL}sounds/`;

  /** Master volume, 0-1. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  /** Creates (or resumes) the audio context; call from a user gesture. */
  unlock(): void {
    const context = this.ensureContext();
    if (context && context.state === "suspended") void context.resume();
  }

  /** Fetches every sample so the first play is not late. */
  preload(): void {
    for (const files of Object.values(LIBRARY)) for (const file of files) void this.load(file);
  }

  play(name: SoundName, options: PlayOptions = {}): SoundHandle {
    const context = this.ensureContext();
    const master = this.master;
    if (!context || !master || this.muted) return { stop: () => undefined };
    const files = LIBRARY[name];
    const file = files[Math.floor(Math.random() * files.length)];
    if (!file) return { stop: () => undefined };
    let source: AudioBufferSourceNode | null = null;
    let cancelled = false;
    void this.load(file).then((buffer) => {
      if (!buffer || cancelled) return;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = options.rate ?? 1;
      const gain = context.createGain();
      gain.gain.value = options.volume ?? 1;
      source.connect(gain).connect(master);
      source.start();
    });
    return {
      stop: () => {
        cancelled = true;
        try {
          source?.stop();
        } catch {
          // already stopped
        }
      },
    };
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
      return this.context;
    } catch {
      return null;
    }
  }

  private load(file: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(file);
    if (cached) return cached;
    const context = this.ensureContext();
    if (!context) return Promise.resolve(null);
    const promise = fetch(this.base + file)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
      .then((data) => context.decodeAudioData(data))
      .catch((error: unknown) => {
        console.warn(`Could not load sound ${file}`, error);
        return null;
      });
    this.buffers.set(file, promise);
    return promise;
  }
}

export const sfx = new Sfx();
