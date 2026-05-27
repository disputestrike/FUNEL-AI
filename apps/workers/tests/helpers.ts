/**
 * Test helpers for the workers service.
 *
 * The workers service is heavy on side-effecty integrations. Rather than spin
 * up Redis + Postgres + every provider sandbox in unit tests, we wire mocks
 * via vi.doMock that match the dynamic-import shape each worker uses.
 *
 * The mocks are intentionally per-test so a misconfiguration in one suite
 * doesn't leak into another.
 */

import { vi, beforeEach, afterEach } from "vitest";

type MockRegistry = Map<string, Record<string, unknown>>;

const activeMocks: MockRegistry = new Map();

export function mockPackage(name: string, impl: Record<string, unknown>): void {
  activeMocks.set(name, impl);
  vi.doMock(name, () => impl);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  for (const name of activeMocks.keys()) {
    vi.doUnmock(name);
  }
  activeMocks.clear();
  vi.restoreAllMocks();
});

/**
 * Stand-in BullMQ Job for unit tests. Worker code only touches a few fields:
 * `id`, `name`, `data`, `attemptsMade`, `opts`, and (in webhooks) `queue.add`.
 */
export function makeJob<T>(data: T, opts: Partial<{ attempts: number; jobId: string; addNext: ReturnType<typeof vi.fn> }> = {}): {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  opts: { attempts?: number };
  queue: { add: ReturnType<typeof vi.fn> };
} {
  return {
    id: opts.jobId ?? `job_${Math.random().toString(36).slice(2)}`,
    name: "test-job",
    data,
    attemptsMade: 0,
    opts: { attempts: opts.attempts ?? 3 },
    queue: { add: opts.addNext ?? vi.fn().mockResolvedValue(undefined) },
  };
}

/** In-memory idempotency cache replacing Redis SET NX for unit tests. */
export function makeMemoryIdempotency(): { redis: { set: ReturnType<typeof vi.fn> } } {
  const seen = new Set<string>();
  const set = vi.fn(async (key: string, _value: string, _ex: string, _ttl: number, mode: string) => {
    if (mode === "NX") {
      if (seen.has(key)) return null;
      seen.add(key);
      return "OK";
    }
    return "OK";
  });
  return { redis: { set: set as never } };
}
