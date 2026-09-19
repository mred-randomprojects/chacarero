import { useEffect, useRef, useState } from "react";

/**
 * Counts down `seconds` from the moment `key` changes and calls `onExpire`
 * once it hits zero. While `paused` the clock is frozen (the player is busy
 * looking at something). Returns the remaining seconds, or null when `key`
 * is null.
 */
export function useCountdown(key: string | null, seconds: number, paused: boolean, onExpire: () => void): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (key === null) {
      setRemaining(null);
      return;
    }
    let left = seconds;
    let fired = false;
    setRemaining(left);
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      if (!pausedRef.current) left -= (now - last) / 1000;
      last = now;
      setRemaining(Math.max(0, left));
      if (left <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        expire.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [key, seconds]);

  return remaining;
}
