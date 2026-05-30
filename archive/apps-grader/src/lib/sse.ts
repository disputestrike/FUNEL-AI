/**
 * SSE helpers for the Next.js Edge runtime.
 */

import type { AuditStreamEvent } from "@funnel/shared";

/** Encode a single SSE event line. */
export function encodeSSE(event: AuditStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Standard SSE response headers. */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** Wrap a stream creator so heartbeats keep proxies from killing the connection. */
export function buildSSEStream(
  produce: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void>,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: heartbeat\ndata: {"ts":${Date.now()}}\n\n`));
        } catch {
          /* connection closed */
        }
      }, 15_000);

      try {
        await produce(controller);
      } catch (err) {
        controller.enqueue(
          enc.encode(
            `event: failed\ndata: ${JSON.stringify({
              type: "failed",
              reason: String(err),
            })}\n\n`,
          ),
        );
      } finally {
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
}
