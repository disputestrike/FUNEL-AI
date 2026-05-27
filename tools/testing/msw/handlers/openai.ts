import { http, HttpResponse, delay } from "msw";

export const openaiHandlers = [
  http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
    const body = (await request.json()) as { model: string };
    await delay(900);
    return HttpResponse.json({
      id: "chatcmpl_test",
      object: "chat.completion",
      created: 1_700_000_000,
      model: body.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify({ ok: true, source: "openai-mock" }) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 200, completion_tokens: 64, total_tokens: 264 },
    });
  }),

  http.post("https://api.openai.com/v1/images/generations", async () => {
    await delay(1200);
    return HttpResponse.json({
      created: 1_700_000_000,
      data: [{ url: "https://test-cdn.gofunnelai.com/mock-image.png", revised_prompt: "" }],
    });
  }),

  http.post("https://api.openai.com/v1/embeddings", () =>
    HttpResponse.json({
      object: "list",
      data: [{ object: "embedding", embedding: new Array(1536).fill(0), index: 0 }],
      model: "text-embedding-3-large",
      usage: { prompt_tokens: 10, total_tokens: 10 },
    }),
  ),
];
