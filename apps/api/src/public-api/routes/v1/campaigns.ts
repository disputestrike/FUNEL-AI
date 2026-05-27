/**
 * /v1/campaigns — manage paid-acquisition campaigns across ad platforms.
 *
 * Create/list/get are local-only. pause/resume call the underlying ads
 * provider via @funnel/integrations and reconcile state in the next sync.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { campaignService } from "@funnel/integrations";
import type { HonoEnv } from "../../../lib/context.js";
import { Campaign, CreateCampaign, CampaignPlatform } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonBody, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const campaignsRoutes = new OpenAPIHono<HonoEnv>();

const ListQuery = PaginationQuery.extend({ platform: CampaignPlatform.optional() });

campaignsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Campaigns"],
    summary: "List campaigns",
    request: { query: ListQuery },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Campaign)) },
  }),
  async (c) => {
    const page = await campaignService.list({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json(page, 200);
  },
);

campaignsRoutes.openapi(
  route({
    method: "post",
    path: "/",
    tags: ["Campaigns"],
    summary: "Create a campaign on the connected ad platform",
    request: { body: jsonBody(CreateCampaign) },
    responses: { 201: jsonResponse("Created", Campaign) },
  }),
  async (c) => {
    const campaign = await campaignService.create({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("json"),
    });
    return c.json(campaign, 201);
  },
);

campaignsRoutes.openapi(
  route({
    method: "post",
    path: "/{id}/pause",
    tags: ["Campaigns"],
    summary: "Pause a running campaign",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Campaign) },
  }),
  async (c) => {
    const campaign = await campaignService.pause({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(campaign, 200);
  },
);

campaignsRoutes.openapi(
  route({
    method: "post",
    path: "/{id}/resume",
    tags: ["Campaigns"],
    summary: "Resume a paused campaign",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Campaign) },
  }),
  async (c) => {
    const campaign = await campaignService.resume({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(campaign, 200);
  },
);
