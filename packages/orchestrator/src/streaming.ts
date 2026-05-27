/**
 * SSE wire format (Doc 19 §D).
 *
 * The orchestrator emits `GenerationEvent`s as an `AsyncIterable`. This module
 * is the glue between that iterable and an HTTP/2 response body — the exact
 * Web Streams / ReadableStream wiring lives in the deploy adapter (Cloudflare
 * Workers / Lambda+APIGW). Here we expose:
 *
 *   - `serializeEvent(event, id)` — produce the on-the-wire SSE frame
 *   - `parseSseFrame(raw)`        — client-side parser, used by the React hook
 *   - `SseEventStream`            — ReadableStream<Uint8Array> wrapper with
 *                                   periodic heartbeats + `Last-Event-ID` replay
 *
 * Heartbeats are required because corporate proxies kill idle SSE connections
 * after ~30s. We send `: ping\n\n` every 15s.
 */

import type { GenerationEvent } from "./types.js";

const HEARTBEAT_INTERVAL_MS = 15_000;
const FRAME_TERMINATOR = "\n\n";

/** Monotonic, per-generation event ID. ULID-like time-prefixed. */
export function makeEventIdGenerator(): () => string {
  let counter = 0;
  return () => {
    const t = Date.now().toString(36);
    const c = (counter++).toString(36).padStart(4, "0");
    return `${t}${c}`;
  };
}

/**
 * Render a single SSE frame:
 *   event: agent_chunk
 *   id: 01HRZJ...
 *   data: {"type":"agent_chunk","data":{...}}\n\n
 */
export function serializeEvent(event: GenerationEvent, id: string): string {
  // SSE spec: data lines can't contain raw newlines — chunk them.
  const json = JSON.stringify(event);
  const dataLines = json.split("\n").map((l) => `data: ${l}`).join("\n");
  return `event: ${event.type}\nid: ${id}\n${dataLines}${FRAME_TERMINATOR}`;
}

/** Client-side SSE frame parser; returns `null` for incomplete/heartbeat frames. */
export function parseSseFrame(raw: string): { id?: string; type?: string; data: unknown } | null {
  const lines = raw.split("\n");
  let id: string | undefined;
  let type: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("id:")) id = line.slice(3).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { id, type, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * Wrap a `GenerationEvent` async iterable into a `ReadableStream<Uint8Array>`
 * with heartbeats + replay support. Drops `agent_chunk` events on backpressure
 * (those are recoverable from `agent_completed.output`); never drops a
 * state-changing event.
 */
export interface SseStreamOptions {
  lastEventId?: string | null;
  /** Past events to replay before the new ones — fed by the audit log. */
  replay?: AsyncIterable<{ id: string; event: GenerationEvent }>;
  heartbeatMs?: number;
}

export function toSseReadableStream(
  events: AsyncIterable<GenerationEvent>,
  opts: SseStreamOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const heartbeat = opts.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;
  const nextId = makeEventIdGenerator();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // controller closed; ignore.
        }
      }, heartbeat);

      // Replay past events on reconnect.
      if (opts.replay && opts.lastEventId) {
        let seen = false;
        for await (const past of opts.replay) {
          if (!seen && past.id === opts.lastEventId) {
            seen = true;
            continue; // skip the boundary
          }
          if (seen) controller.enqueue(encoder.encode(serializeEvent(past.event, past.id)));
        }
        if (!seen) {
          // unknown last-event-id — replay everything.
          for await (const past of opts.replay) {
            controller.enqueue(encoder.encode(serializeEvent(past.event, past.id)));
          }
        }
      }

      try {
        for await (const ev of events) {
          const id = nextId();
          controller.enqueue(encoder.encode(serializeEvent(ev, id)));
          // Terminal events close the stream.
          if (
            ev.type === "generation_completed" ||
            ev.type === "generation_failed"
          ) {
            break;
          }
        }
      } catch (err) {
        // Always emit a terminal failure so the client knows we're done.
        const failure: GenerationEvent = {
          type: "generation_failed",
          data: {
            generationId: "unknown",
            reason: err instanceof Error ? err.message : String(err),
            code: "internal",
            ts: new Date().toISOString(),
          },
        };
        try {
          controller.enqueue(encoder.encode(serializeEvent(failure, nextId())));
        } catch {
          /* already closed */
        }
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });
}

/**
 * Bounded async queue used inside the orchestrator to bridge "agents emit
 * events from many fibers" with "we yield ONE event stream to the caller."
 * Drops `agent_chunk` events on overflow (Doc 19 §D.4).
 */
export class EventQueue {
  private readonly buffer: GenerationEvent[] = [];
  private waiters: ((ev: GenerationEvent) => void)[] = [];
  private closed = false;
  private droppedChunks = 0;

  constructor(private readonly maxBytes = 1024 * 1024) {}

  push(event: GenerationEvent): void {
    if (this.closed) return;
    if (this.bufferBytes() >= this.maxBytes && event.type === "agent_chunk") {
      this.droppedChunks++;
      return;
    }
    const w = this.waiters.shift();
    if (w) w(event);
    else this.buffer.push(event);
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length) {
      const w = this.waiters.shift()!;
      w({
        type: "generation_completed",
        data: {
          generationId: "",
          funnelId: "",
          url: "",
          totalCostCents: 0,
          durationMs: 0,
          ts: new Date().toISOString(),
        },
      });
    }
  }

  async *iterator(): AsyncIterable<GenerationEvent> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
        continue;
      }
      if (this.closed) return;
      const ev = await new Promise<GenerationEvent>((resolve) => {
        this.waiters.push(resolve);
      });
      if (this.closed && ev.type === "generation_completed" && ev.data.generationId === "") {
        return;
      }
      yield ev;
    }
  }

  get droppedChunkCount(): number {
    return this.droppedChunks;
  }

  private bufferBytes(): number {
    // approximate — saves us walking the whole buffer per push
    return this.buffer.length * 256;
  }
}
