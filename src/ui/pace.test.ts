import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HURRY_RATE, Pace } from "./pace";

describe("Pace", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("holds for the given seconds at pace 1", async () => {
    const pace = new Pace(() => Date.now());
    let done = false;
    void pace.wait(2).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1_990);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(done).toBe(true);
  });

  it("a hurry mid-way finishes what is left at the faster pace", async () => {
    const pace = new Pace(() => Date.now());
    let done = false;
    void pace.wait(4).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1_000); // 3 s left
    pace.set(HURRY_RATE); // → 1.5 s real time
    await vi.advanceTimersByTimeAsync(1_490);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(done).toBe(true);
  });

  it("slowing back down stretches what is left, and a hold started while hurried is short", async () => {
    const pace = new Pace(() => Date.now());
    pace.set(HURRY_RATE);
    let quick = false;
    void pace.wait(2).then(() => (quick = true));
    await vi.advanceTimersByTimeAsync(500); // 1 s of replay time consumed, 1 s left
    pace.set(1); // → 1 s real time
    await vi.advanceTimersByTimeAsync(990);
    expect(quick).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(quick).toBe(true);
    expect(pace.rate).toBe(1);
  });
});
