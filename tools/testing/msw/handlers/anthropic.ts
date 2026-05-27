import { http, HttpResponse, delay } from "msw";

/**
 * Realistic latency band per Doc-08: Anthropic /v1/messages typical 800-2200ms.
 * The mock chooses a deterministic value from the request hash so the same
 * input always returns the same latency (helpful for snapshot tests).
 */
function pickLatency(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 800 + (h % 1400);
}

export const anthropicHandlers = [
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = (await request.json()) as {
      model: string;
      messages: { role: string; content: string }[];
      system?: string;
      max_tokens?: number;
    };

    // Allow chaos tests to inject failures via header.
    const chaos = request.headers.get("x-test-chaos");
    if (chaos === "503") return new HttpResponse(null, { status: 503 });
    if (chaos === "timeout") {
      await delay(35_000);
    }

    const text = String(body.messages?.[body.messages.length - 1]?.content ?? "");
    await delay(pickLatency(text));

    // Echo back a deterministic, JSON-parseable response.
    return HttpResponse.json({
      id: "msg_test_" + (text.length || 0),
      type: "message",
      role: "assistant",
      model: body.model,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            echo: text.slice(0, 80),
            generated: "mock-response",
          }),
        },
      ],
      stop_reason: "end_turn",
      usage: {
        input_tokens: Math.min(8000, text.length),
        output_tokens: 256,
      },
    });
  }),

  http.post("https://api.anthropic.com/v1/messages/batches", () =>
    HttpResponse.json({ id: "batch_test", processing_status: "in_progress" }),
  ),
];
