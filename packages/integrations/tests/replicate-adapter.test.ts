/**
 * ReplicateImageClient — covers Flux create+poll, model routing, NSFW classifier.
 */
import { describe, expect, it, vi } from "vitest";
import { ReplicateImageClient, REPLICATE_LIST_RATES } from "../src/adapters/replicate.js";

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ReplicateImageClient.run", () => {
  it("calls model-specific endpoint for Flux 1.1 Pro and returns the first output url", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ id: "p1", status: "starting" }))
      .mockResolvedValueOnce(
        mockResponse({
          id: "p1",
          status: "succeeded",
          output: "https://replicate.delivery/p1.webp",
          metrics: { predict_time: 4.5 },
        }),
      );
    const client = new ReplicateImageClient({
      apiToken: "r_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 1,
    });
    const result = await client.run({
      model: "flux-1.1-pro",
      prompt: "solar panels on suburban roof, golden hour",
      aspectRatio: "16:9",
    });
    expect(result.url).toBe("https://replicate.delivery/p1.webp");
    expect(result.model).toBe("flux-1.1-pro");
    expect(result.costCents).toBe(REPLICATE_LIST_RATES["flux-1.1-pro"]);
    expect(result.predictTimeMs).toBe(4500);
    // First call should be to model-specific predictions endpoint.
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
    );
  });

  it("routes Ideogram v2 to its model endpoint and parses array output", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ id: "p2", status: "starting" }))
      .mockResolvedValueOnce(
        mockResponse({ id: "p2", status: "succeeded", output: ["https://replicate.delivery/i.png"] }),
      );
    const client = new ReplicateImageClient({
      apiToken: "r_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 1,
    });
    const result = await client.run({ model: "ideogram-v2", prompt: "logo style hero" });
    expect(result.url).toBe("https://replicate.delivery/i.png");
    expect(result.costCents).toBe(REPLICATE_LIST_RATES["ideogram-v2"]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.replicate.com/v1/models/ideogram-ai/ideogram-v2/predictions",
    );
  });

  it("uses version-based /v1/predictions for SDXL and includes width/height", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ id: "p3", status: "starting" }))
      .mockResolvedValueOnce(
        mockResponse({ id: "p3", status: "succeeded", output: "https://r.delivery/sdxl.png" }),
      );
    const client = new ReplicateImageClient({
      apiToken: "r_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 1,
    });
    const result = await client.run({ model: "sdxl", prompt: "test", aspectRatio: "1:1" });
    expect(result.model).toBe("sdxl");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.replicate.com/v1/predictions");
    const sentBody = JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string);
    expect(sentBody.version).toBeTruthy();
    expect(sentBody.input.width).toBe(1024);
    expect(sentBody.input.height).toBe(1024);
  });

  it("throws on prediction failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ id: "px", status: "starting" }))
      .mockResolvedValueOnce(mockResponse({ id: "px", status: "failed", error: "policy violation" }));
    const client = new ReplicateImageClient({
      apiToken: "r_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 1,
    });
    await expect(client.run({ model: "flux-1.1-pro", prompt: "x" })).rejects.toThrow(/policy violation/);
  });

  it("hasToken reflects api token presence", () => {
    expect(new ReplicateImageClient({ apiToken: "x" }).hasToken()).toBe(true);
    expect(new ReplicateImageClient({ apiToken: "" }).hasToken()).toBe(process.env["REPLICATE_API_TOKEN"] ? true : false);
  });
});
