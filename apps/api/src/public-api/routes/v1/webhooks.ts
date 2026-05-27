/**
 * /v1/webhooks — register customer webhook endpoints.
 *
 * Each endpoint gets its own HMAC-SHA256 secret. The secret is returned
 * exactly once (on create) — afterwards only the last 4 chars are visible.
 * Delivery + retry policy lives in @funnel/notifications.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { webhookEndpointService } from "@funnel/notifications";
import type { HonoEnv } from "../../../lib/context.js";
import { Webhook, CreateWebhook } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonBody, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const webhooksRoutes = new OpenAPIHono<HonoEnv>();

webhooksRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Webhooks"],
    summary: "List registered webhook endpoints",
    request: { query: PaginationQuery },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Webhook)) },
  }),
  async (c) => {
    const page = await webhookEndpointService.list({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json(page, 200);
  },
);

webhooksRoutes.openapi(
  route({
    method: "post",
    path: "/",
    tags: ["Webhooks"],
    summary: "Register a webhook endpoint",
    request: { body: jsonBody(CreateWebhook) },
    responses: {
      201: jsonResponse(
        "Created — full secret is included only in this response",
        Webhook.extend({ secret: z.string() }),
      ),
    },
  }),
  async (c) => {
    const { webhook, secret } = await webhookEndpointService.register({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("json"),
    });
    return c.json({ ...webhook, secret }, 201);
  },
);

webhooksRoutes.openapi(
  route({
    method: "delete",
    path: "/{id}",
    tags: ["Webhooks"],
    summary: "Delete a webhook endpoint",
    request: { params: idParam },
    responses: { 204: { description: "Deleted" } },
  }),
  async (c) => {
    await webhookEndpointService.delete({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.body(null, 204);
  },
);

webhooksRoutes.openapi(
  route({
    method: "post",
    path: "/{id}/retry",
    tags: ["Webhooks"],
    summary: "Retry the most recent failed deliveries for this endpoint",
    request: {
      params: idParam,
      body: jsonBody(z.object({ since: z.string().datetime().optional() })),
    },
    responses: { 202: jsonResponse("Accepted", z.object({ retried: z.number() })) },
  }),
  async (c) => {
    const result = await webhookEndpointService.replayFailed({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
      since: c.req.valid("json").since,
    });
    return c.json({ retried: result.count }, 202);
  },
);
