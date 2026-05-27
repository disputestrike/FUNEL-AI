/**
 * OpenAPI 3.1 document for the GoFunnelAI public REST API.
 *
 * Built directly from the OpenAPIHono router so the spec can never drift
 * from the implementation. Served live at GET /v1/openapi.json and also
 * snapshotted to disk by scripts/generate-openapi.ts for SDK codegen.
 */

import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../lib/context.js";

const SECURITY = {
  bearerAuth: {
    type: "http" as const,
    scheme: "bearer" as const,
    bearerFormat: "API Key",
    description:
      "Use a workspace API key: `Authorization: Bearer fnl_live_â€¦`. Generate keys at https://app.gofunnelai.com/settings/api-keys.",
  },
};

const TAGS = [
  { name: "Funnels", description: "Create, generate, and publish funnels." },
  { name: "Leads", description: "Capture leads and run scoring/qualification." },
  { name: "Contacts", description: "CRM contact records." },
  { name: "Campaigns", description: "Paid acquisition across Meta, Google, TikTok, LinkedIn." },
  { name: "Integrations", description: "Inspect and disconnect third-party connections." },
  { name: "Analytics", description: "Cohorts, retention, conversion, revenue." },
  { name: "Webhooks", description: "Register your own endpoints for event delivery." },
  { name: "VoiceCalls", description: "RevTry AI voice agent activity." },
  { name: "Bookings", description: "Calendar bookings synced to your scheduling provider." },
];

export const attachOpenApi = (app: OpenAPIHono<HonoEnv>) => {
  app.doc31("/openapi.json", (c) => ({
    openapi: "3.1.0",
    info: {
      title: "GoFunnelAI API",
      version: "1.0.0",
      description:
        "Public REST API for GoFunnelAI. Build funnels, capture leads, run campaigns, " +
        "and orchestrate the AI voice agent. All endpoints are HTTPS-only and " +
        "authenticated by Bearer API key. See https://developers.gofunnelai.com for guides.",
      termsOfService: "https://gofunnelai.com/legal/terms",
      contact: { name: "GoFunnelAI Developer Support", email: "devs@gofunnelai.com", url: "https://developers.gofunnelai.com" },
      license: { name: "Proprietary", url: "https://gofunnelai.com/legal/api" },
    },
    servers: [
      { url: "https://api.gofunnelai.com/v1", description: "Production" },
      { url: "https://api.staging.gofunnelai.com/v1", description: "Staging / sandbox" },
    ],
    tags: TAGS,
    externalDocs: {
      description: "Developer portal",
      url: "https://developers.gofunnelai.com",
    },
  }));

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", SECURITY.bearerAuth);
};
