import { vi } from "vitest";

/** Freezes time for a test block; returns a step function. */
export function freezeClock(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  return {
    advance(ms: number) {
      vi.advanceTimersByTime(ms);
    },
    advanceDays(days: number) {
      vi.advanceTimersByTime(days * 86_400_000);
    },
    restore() {
      vi.useRealTimers();
    },
  };
}
