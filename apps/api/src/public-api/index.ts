/**
 * Public REST API entry point.
 *
 * Mounted into the top-level Hono app at /v1. Composes:
 *   - versioning header / mount-point handling
 *   - api-key auth → workspace context
 *   - per-key rate limiting (plan-aware)
 *   - idempotency-key replay
 *   - all resource sub-routers
 *   - OpenAPI 3.1 spec + Swagger UI
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../lib/context.js";

import { apiKeyAuth } from "./middleware/api-key-auth.js";
import { publicApiRateLimit } from "./middleware/rate-limit.js";
import { idempotency } from "./middleware/idempotency.js";
import { versioning } from "./middleware/versioning.js";
import { attachOpenApi } from "./openapi.js";
import { mountSwaggerUi } from "./swagger-ui.js";

import { funnelsRoutes } from "./routes/v1/funnels.js";
import { leadsRoutes } from "./routes/v1/leads.js";
import { contactsRoutes } from "./routes/v1/contacts.js";
import { campaignsRoutes } from "./routes/v1/campaigns.js";
import { integrationsRoutes } from "./routes/v1/integrations.js";
import { analyticsRoutes } from "./routes/v1/analytics.js";
import { webhooksRoutes } from "./routes/v1/webhooks.js";
import { voiceCallsRoutes } from "./routes/v1/voice-calls.js";
import { bookingsRoutes } from "./routes/v1/bookings.js";

export const publicApi = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "validation_failed",
            type: "invalid_request",
            message: "Request validation failed.",
            request_id: c.get("requestId") ?? "unknown",
            details: result.error.flatten(),
          },
        },
        400,
      );
    }
  },
});

// Spec endpoint is public — clients fetch it for SDK regeneration.
attachOpenApi(publicApi);
mountSwaggerUi(publicApi);

// Order matters. Versioning first (cheap, always-on), then auth, then rate
// limit (needs principal), then idempotency (needs workspace).
publicApi.use("*", versioning("v1"));
publicApi.use("*", apiKeyAuth());
publicApi.use("*", publicApiRateLimit());
publicApi.use("*", idempotency());

publicApi.route("/funnels", funnelsRoutes);
publicApi.route("/leads", leadsRoutes);
publicApi.route("/contacts", contactsRoutes);
publicApi.route("/campaigns", campaignsRoutes);
publicApi.route("/integrations", integrationsRoutes);
publicApi.route("/analytics", analyticsRoutes);
publicApi.route("/webhooks", webhooksRoutes);
publicApi.route("/voice-calls", voiceCallsRoutes);
publicApi.route("/bookings", bookingsRoutes);
