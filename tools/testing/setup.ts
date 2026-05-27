/**
 * Global test setup — runs before every vitest worker.
 *
 *  - Installs MSW handlers for every external API we use
 *  - Fixes the Math.random seed for deterministic agent runs
 *  - Sets test env vars (no real secrets)
 *  - Freezes Date.now() in regression runs (see tools/testing/clock.ts)
 */
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw/server";
import { seedRandom } from "./random";

// Stable RNG seed — every fixture run is reproducible.
seedRandom(0xfunne1a1 >>> 0);

// Test env defaults.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
process.env.PAYPAL_WEBHOOK_ID = "test-paypal-webhook-id";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_stripe";
process.env.RESEND_WEBHOOK_SECRET = "whsec_test_resend";
process.env.SIGNALWIRE_WEBHOOK_SECRET = "test-sw-secret";
process.env.REVTRY_WEBHOOK_SECRET = "test-revtry-secret";
process.env.META_APP_SECRET = "test-meta-app-secret";
process.env.GOOGLE_ADS_WEBHOOK_SECRET = "test-google-ads-secret";
process.env.TIKTOK_WEBHOOK_SECRET = "test-tiktok-secret";
process.env.LINKEDIN_WEBHOOK_SECRET = "test-li-secret";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.OPENAI_API_KEY = "sk-openai-test";
process.env.RESEND_API_KEY = "re_test";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => {
  server.close();
});
