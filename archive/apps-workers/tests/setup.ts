/**
 * Global test setup — runs before every test file. Sets env defaults so
 * `loadConfig()` doesn't throw, mocks ioredis + bullmq so importing a worker
 * module never opens a real Redis socket, and silences logger noise.
 */
import { beforeAll, vi } from "vitest";

// Mock ioredis — `Redis` is a constructor whose instances only need `.set`,
// `.ping`, `.quit`, `.on`. The set method returns "OK" on first call per key,
// null after, simulating SET NX behaviour.
vi.mock("ioredis", () => {
  class MockRedis {
    private store = new Map<string, string>();
    keyPrefix = "";
    constructor(_opts?: Record<string, unknown>) {}
    async set(key: string, value: string, ..._rest: unknown[]): Promise<string | null> {
      const mode = _rest[2] ?? _rest[1] ?? _rest[0];
      if (mode === "NX") {
        if (this.store.has(key)) return null;
        this.store.set(key, value);
        return "OK";
      }
      this.store.set(key, value);
      return "OK";
    }
    async ping(): Promise<string> {
      return "PONG";
    }
    async quit(): Promise<string> {
      return "OK";
    }
    on(): this {
      return this;
    }
  }
  return { Redis: MockRedis, default: MockRedis };
});

// Mock bullmq — Workers/Queues are only constructed; tests exercise the
// handler directly via `getHandlerForTests`.
vi.mock("bullmq", () => {
  class MockWorker {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    on(_evt: string, _fn: unknown): this {
      return this;
    }
    async pause(): Promise<void> {}
    async close(): Promise<void> {}
  }
  class MockQueue {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    add = vi.fn(async (_n: string, _d: unknown, _o?: unknown) => ({ id: "q_mock" }));
    upsertJobScheduler = vi.fn(async () => undefined);
    removeJobScheduler = vi.fn(async () => undefined);
    getJobCounts = vi.fn(async () => ({ waiting: 0, delayed: 0, active: 0 }));
    async close(): Promise<void> {}
  }
  class MockQueueEvents {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    on(): this {
      return this;
    }
    async close(): Promise<void> {}
  }
  return { Worker: MockWorker, Queue: MockQueue, QueueEvents: MockQueueEvents };
});

// Sentry — turn into a no-op so we never reach the network in tests.
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  close: vi.fn(async () => true),
  withScope: (fn: (s: { setExtra: () => void }) => void) => fn({ setExtra: () => undefined }),
  captureException: vi.fn(),
}));

beforeAll(() => {
  process.env["NODE_ENV"] = "test";
  process.env["REDIS_URL"] ??= "redis://localhost:6379";
  process.env["DATABASE_URL"] ??= "postgresql://test:test@localhost:5432/test";
  process.env["HEALTH_PORT"] ??= "0";
  process.env["RELEASE"] ??= "test";
});

// Quiet structured logger by default; individual tests opt back in by
// `vi.unstubAllGlobals()`.
vi.spyOn(console, "log").mockImplementation(() => undefined);
vi.spyOn(console, "error").mockImplementation(() => undefined);
