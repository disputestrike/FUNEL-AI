/**
 * Idempotency-Key support, modeled after the Stripe pattern.
 *
 * Behavior:
 *   - Only applied to POST/PATCH/DELETE (mutating verbs).
 *   - When the header is present, we hash (key + workspace_id + path + body)
 *     and store the resulting response in KV for 24h.
 *   - A replay with the same key but a *different* payload returns 409.
 *   - In-flight requests with the same key return 409 to prevent
 *     double-execution while the original is still computing.
 */

import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "../../lib/context.js";

const TTL_SEC = 60 * 60 * 24; // 24h
const LOCK_TTL_SEC = 60;

interface StoredResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  request_fingerprint: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const idempotency = (): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return next();
    }
    const idemKey = c.req.header("idempotency-key");
    if (!idemKey) return next();
    if (idemKey.length > 255) {
      throw new HTTPException(400, { message: "Idempotency-Key must be <= 255 chars." });
    }

    const principal = c.get("apiKey");
    const workspaceId = principal?.workspace_id ?? "anon";
    const rawBody = await c.req.text(); // consume; we'll restore below
    const fingerprint = await sha256Hex(`${method}|${c.req.path}|${rawBody}`);
    const storeKey = `idem:${workspaceId}:${idemKey}`;

    // KV binding — IDEMPOTENCY_KV namespace, declared in wrangler.toml.
    const kv = c.env.IDEMPOTENCY_KV;

    const existing = (await kv.get(storeKey, "json")) as StoredResponse | { lock: true } | null;
    if (existing && "lock" in existing) {
      throw new HTTPException(409, {
        message: "A request with this Idempotency-Key is already in flight.",
      });
    }
    if (existing && "body" in existing) {
      if (existing.request_fingerprint !== fingerprint) {
        throw new HTTPException(409, {
          message: "Idempotency-Key reused with a different request payload.",
        });
      }
      const replay = new Response(existing.body, {
        status: existing.status,
        headers: existing.headers,
      });
      replay.headers.set("Idempotent-Replay", "true");
      return replay;
    }

    // Take the lock and let the handler run.
    await kv.put(storeKey, JSON.stringify({ lock: true }), { expirationTtl: LOCK_TTL_SEC });

    // Re-inject the consumed body so downstream parsers can read it.
    const original = c.req.raw;
    const cloned = new Request(original.url, {
      method: original.method,
      headers: original.headers,
      body: rawBody || null,
    });
    (c.req as unknown as { raw: Request }).raw = cloned;

    await next();

    const res = c.res;
    if (res && res.status < 500) {
      const responseBody = await res.clone().text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const stored: StoredResponse = {
        status: res.status,
        headers,
        body: responseBody,
        request_fingerprint: fingerprint,
      };
      c.executionCtx.waitUntil(
        kv.put(storeKey, JSON.stringify(stored), { expirationTtl: TTL_SEC }),
      );
    } else {
      // Failed — drop the lock so the client can retry.
      c.executionCtx.waitUntil(kv.delete(storeKey));
    }
  };
};
