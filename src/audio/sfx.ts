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
  | "dealDone"
  | "turn"
  | "error"
  | "open"
  | "close"
  | "bankrupt"
  | "win"
  /** Synthesized, not a sample: the "wah wah wah waaah" of a turned-down deal. */
  | "sadTrombone";

const LIBRARY: Readonly<Record<Exclude<SoundName, "sadTrombone">, readonly string[]>> = {
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
  dealDone: ["confirmation_002.ogg"],
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
    if (name === "sadTrombone") return this.sadTrombone(context, master, options.volume ?? 1);
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

  /**
   * Four descending notes on a filtered sawtooth, each sliding down into
   * the next, the last one wobbling: the classic "wah wah wah waaah".
   */
  private sadTrombone(context: AudioContext, master: GainNode, volume: number): SoundHandle {
    const start = context.currentTime + 0.02;
    const notes: readonly { readonly hz: number; readonly length: number }[] = [
      { hz: 466, length: 0.45 },
      { hz: 440, length: 0.45 },
      { hz: 415, length: 0.45 },
      { hz: 392, length: 1.3 },
    ];
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 2;
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(filter).connect(gain).connect(master);
    let t = start;
    notes.forEach((note, i) => {
      const last = i === notes.length - 1;
      oscillator.frequency.setValueAtTime(note.hz * 1.06, t);
      oscillator.frequency.exponentialRampToValueAtTime(note.hz, t + 0.12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.05);
      if (last) {
        oscillator.frequency.setValueAtTime(note.hz, t + 0.3);
        oscillator.frequency.exponentialRampToValueAtTime(note.hz * 0.84, t + note.length);
        gain.gain.setValueAtTime(0.35 * volume, t + note.length * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.length);
      } else {
        gain.gain.setValueAtTime(0.35 * volume, t + note.length - 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.length);
      }
      t += note.length + 0.05;
    });
    // Vibrato on the long last note.
    const lfo = context.createOscillator();
    lfo.frequency.value = 6;
    const depth = context.createGain();
    depth.gain.value = 6;
    lfo.connect(depth).connect(oscillator.frequency);
    const lastStart = start + notes.slice(0, -1).reduce((sum, n) => sum + n.length + 0.05, 0) + 0.3;
    lfo.start(lastStart);
    oscillator.start(start);
    oscillator.stop(t + 0.1);
    lfo.stop(t + 0.1);
    return {
      stop: () => {
        try {
          oscillator.stop();
          lfo.stop();
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
