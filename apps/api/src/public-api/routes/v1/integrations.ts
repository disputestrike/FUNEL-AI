/**
 * /v1/integrations — inspect and disconnect third-party connections.
 * Adding a new integration is an OAuth flow handled outside the REST API.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { integrationService } from "@funnel/integrations";
import type { HonoEnv } from "../../../lib/context.js";
import { Integration } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const integrationsRoutes = new OpenAPIHono<HonoEnv>();

integrationsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Integrations"],
    summary: "List connected integrations",
    request: { query: PaginationQuery },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Integration)) },
  }),
  async (c) => {
    const page = await integrationService.list({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json(page, 200);
  },
);

integrationsRoutes.openapi(
  route({
    method: "delete",
    path: "/{id}",
    tags: ["Integrations"],
    summary: "Disconnect an integration",
    request: { params: idParam },
    responses: { 204: { description: "Disconnected" } },
  }),
  async (c) => {
    await integrationService.disconnect({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.body(null, 204);
  },
);
