/**
 * Redis connection management.
 *
 * BullMQ requires three logical connections per worker (queue client, worker
 * client, scheduler). We use a single ioredis factory that returns fresh
 * `Redis` instances configured for BullMQ semantics (no auto-reconnect retries
 * that would defeat the queue's own backoff).
 */

import { Redis, type RedisOptions } from "ioredis";

import { loadConfig } from "./config.js";

/** BullMQ insists `maxRetriesPerRequest: null` on its bclient connection. */
function bullmqOptions(): RedisOptions {
  const cfg = loadConfig();
  const url = new URL(cfg.REDIS_URL);
  const opts: RedisOptions = {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    keyPrefix: cfg.REDIS_KEY_PREFIX,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    connectTimeout: 10_000,
    // Upstash + most managed providers require TLS:
    tls: cfg.REDIS_TLS || url.protocol === "rediss:" ? {} : undefined,
  };
  return opts;
}

const liveConnections: Redis[] = [];

/**
 * Create a fresh Redis connection. Caller is responsible for `.quit()` during
 * shutdown. We track the connection in `liveConnections` so graceful-shutdown
 * can close them all even if the worker forgot.
 */
export function createRedisConnection(label = "default"): Redis {
  const client = new Redis(bullmqOptions());
  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: "error",
        service: "workers.redis",
        connection: label,
        message: "Redis connection error",
        error: err.message,
      }),
    );
  });
  liveConnections.push(client);
  return client;
}

/** Quit all tracked connections. Idempotent. */
export async function closeAllRedis(): Promise<void> {
  await Promise.allSettled(liveConnections.map((c) => c.quit().catch(() => undefined)));
  liveConnections.length = 0;
}

/** For readiness probes — round-trips a PING. */
export async function pingRedis(client: Redis): Promise<boolean> {
  try {
    const reply = await client.ping();
    return reply === "PONG";
  } catch {
    return false;
  }
}
