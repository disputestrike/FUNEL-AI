/**
 * StockClient — Unsplash + Pexels licensed-stock fallback adapter tests.
 */
import { describe, expect, it, vi } from "vitest";
import { StockClient } from "../src/adapters/stock.js";

describe("StockClient", () => {
  it("returns Unsplash result with attribution when UNSPLASH_ACCESS_KEY is set", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: "abc",
              urls: { regular: "https://images.unsplash.com/abc", thumb: "https://images.unsplash.com/abc-t", small: "https://x" },
              width: 1600,
              height: 1067,
              links: { html: "https://unsplash.com/photos/abc", download_location: "https://api.unsplash.com/dl/abc" },
              user: { name: "Jane Doe", links: { html: "https://unsplash.com/@jane" } },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new StockClient({ unsplashAccessKey: "ua_test", fetchImpl: fetchImpl as unknown as typeof fetch });
    const hit = await client.search({ query: "solar panels rooftop", industry: "solar" });
    expect(hit.source).toBe("unsplash");
    expect(hit.license).toBe("unsplash_license_v1");
    expect(hit.url).toBe("https://images.unsplash.com/abc");
    expect(hit.attribution.photographer).toBe("Jane Doe");
    expect(hit.attribution.htmlCredit).toContain("Jane Doe");
    expect(hit.attribution.htmlCredit).toContain("Unsplash");
    expect(hit.trackDownloadUrl).toBe("https://api.unsplash.com/dl/abc");
    // Query should be industry-biased.
    expect(fetchImpl.mock.calls[0]?.[0]).toMatch(/solar%20panel%20rooftop%20home/);
  });

  it("falls back to Pexels when Unsplash returns no results", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            photos: [
              {
                id: 1,
                width: 1600,
                height: 1067,
                url: "https://pexels.com/photo/1",
                photographer: "John Roe",
                photographer_url: "https://pexels.com/@john",
                src: { large2x: "https://images.pexels.com/1.jpg", large: "x", medium: "y", tiny: "z" },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const client = new StockClient({
      unsplashAccessKey: "ua_test",
      pexelsApiKey: "pk_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const hit = await client.search({ query: "dental smile" });
    expect(hit.source).toBe("pexels");
    expect(hit.license).toBe("pexels_free_license");
    expect(hit.url).toBe("https://images.pexels.com/1.jpg");
    expect(hit.attribution.photographer).toBe("John Roe");
  });

  it("hasAnyKey reflects configured providers", () => {
    expect(new StockClient({ unsplashAccessKey: "x" }).hasAnyKey()).toBe(true);
    expect(new StockClient({ pexelsApiKey: "x" }).hasAnyKey()).toBe(true);
    expect(new StockClient({}).hasAnyKey()).toBe(process.env["UNSPLASH_ACCESS_KEY"] ? true : process.env["PEXELS_API_KEY"] ? true : false);
  });

  it("trackDownload pings Unsplash with the Client-ID header", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));
    const client = new StockClient({ unsplashAccessKey: "ua", fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.trackDownload({ trackDownloadUrl: "https://api.unsplash.com/dl/x" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.unsplash.com/dl/x",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Client-ID ua" }) }),
    );
  });
});
