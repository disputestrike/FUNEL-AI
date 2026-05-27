/**
 * Health check server.
 *
 * Three endpoints (RFC: /healthz + /readyz + /metrics is the de-facto
 * Kubernetes / Railway / Fly contract):
 *
 *   GET /healthz   → 200 always once the process is up (liveness)
 *   GET /readyz    → 200 iff Redis + DB are both reachable (readiness)
 *   GET /metrics   → Prometheus exposition format
 *
 * Implementation uses the Node http module — no Express dep, no Hono dep. This
 * surface is tiny and we want zero risk of an upstream framework upgrade
 * cratering our liveness probe.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { Redis } from "ioredis";

import { loadConfig } from "./config.js";
import { log, promRegistry } from "./monitoring.js";
import { pingRedis } from "./redis.js";

export interface ReadinessCheck {
  redis: Redis;
  /** Optional DB ping — wired by the entrypoint once Prisma is connected. */
  pingDb?: () => Promise<boolean>;
}

/** Build + start the health server. Returns the underlying server for shutdown. */
export function startHealthServer(checks: ReadinessCheck): Server {
  const cfg = loadConfig();
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    if (url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "workers", release: cfg.RELEASE }));
      return;
    }
    if (url === "/readyz") {
      const redisOk = await pingRedis(checks.redis);
      const dbOk = checks.pingDb ? await checks.pingDb() : true;
      const ok = redisOk && dbOk;
      res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok, checks: { redis: redisOk, db: dbOk } }));
      return;
    }
    if (url === "/metrics") {
      try {
        const body = await promRegistry.metrics();
        res.writeHead(200, { "content-type": promRegistry.contentType });
        res.end(body);
      } catch (err) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end(`metrics error: ${(err as Error).message}`);
      }
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  server.listen(cfg.HEALTH_PORT, () => {
    log("info", { msg: "health server listening", port: cfg.HEALTH_PORT });
  });
  return server;
}
