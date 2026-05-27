/**
 * GoFunnelAI â€” Durable Object class implementations.
 *
 * These classes are bundled into `apps/api` (their canonical owner) but are
 * also re-exported here so other workers can re-use the same code without
 * copy-paste. The wrangler.toml in each consumer worker references the class
 * by name + script via [[durable_objects.bindings]] -> { script_name = "..." }.
 *
 * Classes provided:
 *   - RateLimitDO        sliding-window per-key rate limiter
 *   - GenerationActor    long-lived actor for a single in-flight generation
 *                        run; coordinates agent steps, SSE updates, retries
 *   - GenerationStreamDO SSE fan-out for clients subscribed to a generation
 */

interface RateLimitState {
  windowStart: number;
  count: number;
}

export interface RateLimitRequest {
  /** Number of requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Cost of this request (default 1). */
  cost?: number;
}

export interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * RateLimitDO â€” fixed-window counter keyed by the DO instance id (one DO per
 * rate-limit-key, e.g. one DO per tenant or one DO per IP).
 *
 * Why a DO rather than `[[unsafe.bindings]].type = "ratelimit"`:
 *   - The CF native ratelimit binding is fixed-window at the worker level,
 *     not per-key; we want per-tenant + per-route limits that compose.
 *   - DOs give us atomic counters in a single region so two concurrent
 *     requests to the same worker can't both pass when only one slot remains.
 */
export class RateLimitDO {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/check") {
      return new Response("not found", { status: 404 });
    }
    const body = (await request.json()) as RateLimitRequest;
    const cost = body.cost ?? 1;
    const now = Date.now();
    const windowMs = body.windowSeconds * 1000;

    const result = await this.state.blockConcurrencyWhile(async () => {
      const stored =
        (await this.state.storage.get<RateLimitState>("state")) ?? {
          windowStart: now,
          count: 0,
        };
      let s = stored;
      if (now - s.windowStart >= windowMs) {
        s = { windowStart: now, count: 0 };
      }
      const allowed = s.count + cost <= body.limit;
      if (allowed) s.count += cost;
      await this.state.storage.put("state", s);
      const resetAt = s.windowStart + windowMs;
      return {
        allowed,
        remaining: Math.max(0, body.limit - s.count),
        resetAt,
      } satisfies RateLimitResponse;
    });

    return Response.json(result);
  }
}

// ---------------------------------------------------------------------------
// GenerationActor â€” drives a single funnel-generation lifecycle.
// ---------------------------------------------------------------------------

interface GenerationStep {
  agent: string;
  status: "queued" | "running" | "complete" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  verdict?: "pass" | "block" | "rewrite";
  errorMessage?: string;
}

interface GenerationActorState {
  generationId: string;
  tenantId: string;
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "blocked"
    | "cancelled";
  steps: GenerationStep[];
  totalCostUsd: number;
  attempts: number;
  startedAt?: number;
  completedAt?: number;
  finalArtifactKey?: string;
  lastError?: string;
}

interface ActorEnv {
  Q_GENERATION: Queue;
  GENERATION_ARTIFACTS: R2Bucket;
  GENERATION_STREAM_DO: DurableObjectNamespace;
  DB: Hyperdrive;
  COST_CEILING_USD_PER_GENERATION: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
}

/**
 * One instance per generation_id. Lives for the duration of the run, then
 * persists its final state and is garbage-collected by CF after 24h of
 * inactivity.
 */
export class GenerationActor {
  private state: DurableObjectState;
  private env: ActorEnv;

  constructor(state: DurableObjectState, env: ActorEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (url.pathname) {
      case "/start":
        return this.start(request);
      case "/status":
        return this.status();
      case "/cancel":
        return this.cancel();
      case "/step-complete":
        return this.stepComplete(request);
      default:
        return new Response("not found", { status: 404 });
    }
  }

  private async start(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      generationId: string;
      tenantId: string;
    };
    const existing =
      await this.state.storage.get<GenerationActorState>("state");
    if (existing && existing.status !== "pending") {
      return Response.json(existing, { status: 409 });
    }
    const initial: GenerationActorState = existing ?? {
      generationId: body.generationId,
      tenantId: body.tenantId,
      status: "pending",
      steps: [],
      totalCostUsd: 0,
      attempts: 0,
    };
    initial.status = "running";
    initial.attempts += 1;
    initial.startedAt = Date.now();

    // Enqueue the first step. The queue consumer will process the agent
    // graph in order and call back via /step-complete.
    await this.env.Q_GENERATION.send({
      generationId: body.generationId,
      tenantId: body.tenantId,
      nextAgent: "planner",
      attempt: initial.attempts,
    });

    await this.state.storage.put("state", initial);
    await this.broadcast(initial);
    return Response.json(initial);
  }

  private async status(): Promise<Response> {
    const s = await this.state.storage.get<GenerationActorState>("state");
    if (!s) return new Response("not found", { status: 404 });
    return Response.json(s);
  }

  private async cancel(): Promise<Response> {
    const s = await this.state.storage.get<GenerationActorState>("state");
    if (!s) return new Response("not found", { status: 404 });
    s.status = "cancelled";
    s.completedAt = Date.now();
    await this.state.storage.put("state", s);
    await this.broadcast(s);
    return Response.json(s);
  }

  private async stepComplete(request: Request): Promise<Response> {
    const update = (await request.json()) as GenerationStep & {
      nextAgent?: string;
      finalArtifactKey?: string;
    };
    const s = await this.state.storage.get<GenerationActorState>("state");
    if (!s) return new Response("not found", { status: 404 });

    s.steps.push({
      agent: update.agent,
      status: update.status,
      startedAt: update.startedAt,
      completedAt: update.completedAt,
      costUsd: update.costUsd,
      tokensIn: update.tokensIn,
      tokensOut: update.tokensOut,
      verdict: update.verdict,
      errorMessage: update.errorMessage,
    });
    s.totalCostUsd += update.costUsd ?? 0;

    // Hard cost ceiling. Refuse to advance if we'd overrun.
    const ceiling = Number(this.env.COST_CEILING_USD_PER_GENERATION || "2.50");
    if (s.totalCostUsd > ceiling) {
      s.status = "failed";
      s.lastError = `cost ceiling exceeded ($${s.totalCostUsd.toFixed(2)} > $${ceiling.toFixed(2)})`;
      s.completedAt = Date.now();
      await this.state.storage.put("state", s);
      await this.broadcast(s);
      return Response.json(s);
    }

    if (update.verdict === "block") {
      s.status = "blocked";
      s.completedAt = Date.now();
    } else if (update.finalArtifactKey) {
      s.status = "succeeded";
      s.finalArtifactKey = update.finalArtifactKey;
      s.completedAt = Date.now();
    } else if (update.status === "failed") {
      s.status = "failed";
      s.lastError = update.errorMessage;
      s.completedAt = Date.now();
    } else if (update.nextAgent) {
      await this.env.Q_GENERATION.send({
        generationId: s.generationId,
        tenantId: s.tenantId,
        nextAgent: update.nextAgent,
        attempt: s.attempts,
      });
    }

    await this.state.storage.put("state", s);
    await this.broadcast(s);
    return Response.json(s);
  }

  private async broadcast(state: GenerationActorState): Promise<void> {
    // Fan out to subscribed SSE clients via the GenerationStreamDO.
    const stream = this.env.GENERATION_STREAM_DO.get(
      this.env.GENERATION_STREAM_DO.idFromName(state.generationId),
    );
    await stream.fetch("https://internal/publish", {
      method: "POST",
      body: JSON.stringify(state),
      headers: { "content-type": "application/json" },
    });
  }
}

// ---------------------------------------------------------------------------
// GenerationStreamDO â€” SSE pub/sub for in-flight generations.
// ---------------------------------------------------------------------------

export class GenerationStreamDO {
  private state: DurableObjectState;
  private subscribers: Set<WritableStreamDefaultWriter<Uint8Array>>;
  private encoder = new TextEncoder();

  constructor(state: DurableObjectState) {
    this.state = state;
    this.subscribers = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/subscribe") return this.subscribe();
    if (url.pathname === "/publish") return this.publish(request);
    return new Response("not found", { status: 404 });
  }

  private async subscribe(): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    this.subscribers.add(writer);

    // Push the last known state immediately so a reconnecting client doesn't
    // have to wait for the next event.
    const last = await this.state.storage.get<unknown>("last");
    if (last) {
      await writer.write(
        this.encoder.encode(`event: snapshot\ndata: ${JSON.stringify(last)}\n\n`),
      );
    }

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      },
    });
  }

  private async publish(request: Request): Promise<Response> {
    const payload = await request.text();
    await this.state.storage.put("last", JSON.parse(payload));
    const frame = this.encoder.encode(`event: update\ndata: ${payload}\n\n`);
    const dead: WritableStreamDefaultWriter<Uint8Array>[] = [];
    for (const w of this.subscribers) {
      try {
        await w.write(frame);
      } catch {
        dead.push(w);
      }
    }
    for (const w of dead) this.subscribers.delete(w);
    return new Response(null, { status: 204 });
  }
}
