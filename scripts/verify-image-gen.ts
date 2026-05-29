/**
 * Manual verification script for the image generation pipeline.
 *
 * Usage:
 *   1. Set env vars (at minimum REPLICATE_API_TOKEN; UNSPLASH_ACCESS_KEY and
 *      PEXELS_API_KEY for the stock fallback path; R2_* for the upload path).
 *   2. Run: `pnpm tsx scripts/verify-image-gen.ts`
 *   3. Confirms:
 *      - Flux 1.1 Pro returns a real URL for "solar panels on suburban roof,
 *        photorealistic, golden hour".
 *      - NSFW classifier returns a passing score.
 *      - (If R2 keys set) Image is uploaded to gofunnelai-assets and the CDN
 *        URL is printed.
 *
 * This is intentionally Node-only and not part of the test suite — it makes
 * real API calls and costs ~$0.04 per run.
 */

import { ReplicateImageClient, StockClient, R2AssetsClient } from "../packages/integrations/src/index.js";

async function main(): Promise<void> {
  const prompt =
    "Solar panels on a suburban single-family home roof, photorealistic, golden hour, real family of four on the porch waving";

  console.log("[verify] starting image gen with prompt:");
  console.log(`  "${prompt}"`);
  console.log();

  const replicate = new ReplicateImageClient();
  if (!replicate.hasToken()) {
    console.log("[verify] REPLICATE_API_TOKEN missing — skipping Replicate test.");
    console.log("         Set it in .env to test live generation.");
    console.log();
  } else {
    console.log("[verify] Calling Flux 1.1 Pro…");
    const t0 = Date.now();
    const result = await replicate.run({
      model: "flux-1.1-pro",
      prompt,
      aspectRatio: "16:9",
    });
    console.log(`[verify] Flux returned in ${Date.now() - t0}ms`);
    console.log(`         url:   ${result.url}`);
    console.log(`         cost:  ${result.costCents}¢`);
    console.log(`         predId: ${result.predictionId}`);
    console.log();

    console.log("[verify] Running NSFW classifier…");
    const safety = await replicate.classifyNSFW(result.url);
    console.log(`         passed:    ${safety.passed}`);
    console.log(`         nsfwScore: ${safety.nsfwScore}`);
    console.log(`         classifier:${safety.classifier}`);
    console.log();

    const r2 = new R2AssetsClient();
    if (r2.hasCredentials()) {
      console.log("[verify] Uploading to R2…");
      const upload = await r2.uploadFromUrl({
        funnelId: "verify_test",
        sourceUrl: result.url,
      });
      console.log(`         cdnUrl: ${upload.cdnUrl}`);
      console.log(`         key:    ${upload.key}`);
      console.log(`         bytes:  ${upload.bytes}`);
    } else {
      console.log("[verify] R2 credentials missing — skipping upload.");
      console.log("         Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.");
    }
    console.log();
  }

  const stock = new StockClient();
  if (stock.hasAnyKey()) {
    console.log("[verify] Stock fallback test…");
    const hit = await stock.search({ query: "solar panels rooftop", industry: "solar" });
    console.log(`         source:    ${hit.source}`);
    console.log(`         url:       ${hit.url}`);
    console.log(`         credit:    ${hit.attribution.htmlCredit}`);
  } else {
    console.log("[verify] No UNSPLASH_ACCESS_KEY or PEXELS_API_KEY — skipping stock.");
  }
}

main().catch((err) => {
  console.error("[verify] failed:", err);
  process.exit(1);
});
