/**
 * How fast the replay runs: 1 is the pace the clock allows for, `HURRY_RATE`
 * the hurried pace (Space/Enter while something plays). The scene's
 * animations scale their frame time by it and the playback's own holds run
 * on its timers, so a hurry speeds up the walk, the flights, the drops and
 * the banners alike — nothing is ever skipped, nothing teleports.
 */
export const HURRY_RATE = 2;

interface Hold {
  /** Unscaled seconds still to go at the moment the timer was (re)started. */
  remaining: number;
  /** Real time the timer was (re)started, ms. */
  since: number;
  handle: ReturnType<typeof setTimeout> | null;
  resolve: () => void;
}

export class Pace {
  private current = 1;
  private readonly holds = new Set<Hold>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get rate(): number {
    return this.current;
  }

  /** Changes the pace; every hold in progress keeps what it has left, at the new pace. */
  set(rate: number): void {
    if (rate === this.current) return;
    const at = this.now();
    for (const hold of this.holds) {
      hold.remaining -= ((at - hold.since) / 1000) * this.current;
      hold.since = at;
      if (hold.handle !== null) clearTimeout(hold.handle);
      hold.handle = this.schedule(hold, rate);
    }
    this.current = rate;
  }

  /** Resolves after `seconds` of replay time: sooner in real time when hurried, even mid-way. */
  wait(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      const hold: Hold = { remaining: seconds, since: this.now(), handle: null, resolve };
      hold.handle = this.schedule(hold, this.current);
      this.holds.add(hold);
    });
  }

  private schedule(hold: Hold, rate: number): ReturnType<typeof setTimeout> {
    return setTimeout(
      () => {
        this.holds.delete(hold);
        hold.resolve();
      },
      Math.max(0, (hold.remaining * 1000) / rate),
    );
  }
}

export const pace = new Pace();
