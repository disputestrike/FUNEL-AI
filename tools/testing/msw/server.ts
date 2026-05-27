import { setupServer } from "msw/node";
import { anthropicHandlers } from "./handlers/anthropic";
import { openaiHandlers } from "./handlers/openai";
import { resendHandlers } from "./handlers/resend";
import { signalwireHandlers } from "./handlers/signalwire";
import { revtryHandlers } from "./handlers/revtry";
import { paypalHandlers } from "./handlers/paypal";
import { stripeHandlers } from "./handlers/stripe";
import { metaHandlers } from "./handlers/meta-ads";
import { googleAdsHandlers } from "./handlers/google-ads";
import { tiktokAdsHandlers } from "./handlers/tiktok-ads";
import { linkedinAdsHandlers } from "./handlers/linkedin-ads";
import { cloudflareHandlers } from "./handlers/cloudflare";

export const server = setupServer(
  ...anthropicHandlers,
  ...openaiHandlers,
  ...resendHandlers,
  ...signalwireHandlers,
  ...revtryHandlers,
  ...paypalHandlers,
  ...stripeHandlers,
  ...metaHandlers,
  ...googleAdsHandlers,
  ...tiktokAdsHandlers,
  ...linkedinAdsHandlers,
  ...cloudflareHandlers,
);

/** Re-export so per-test overrides can be applied: `server.use(http.post(...))`. */
export { http, HttpResponse, passthrough, delay } from "msw";
