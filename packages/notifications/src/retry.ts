/**
 * Retry policy: exponential backoff, max 3 attempts → DLQ.
 *
 * Attempt 1: immediate.
 * Attempt 2: +30s.
 * Attempt 3: +5min.
 * Then: DLQ (state `dlq`).
 */

export function nextAttemptAt(attempts: number, now: number): { at: string | null; dlq: boolean } {
  if (attempts >= 3) return { at: null, dlq: true };
  const delays = [30_000, 5 * 60_000, 30 * 60_000];
  const ms = delays[attempts] ?? 30_000;
  return { at: new Date(now + ms).toISOString(), dlq: false };
}

export const MAX_ATTEMPTS = 3;
