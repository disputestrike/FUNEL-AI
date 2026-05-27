/**
 * /v1/leads — capture, score, qualify, and update leads.
 *
 * The POST endpoint is the recommended ingestion path for partner-built
 * lead-capture forms (server-to-server). The qualify action runs the same
 * scoring pipeline used by the in-product form-submit webhook.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { leadService } from "@funnel/crm";
import type { HonoEnv } from "../../../lib/context.js";
import { Lead, CreateLead, UpdateLead, LeadStatus } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonBody, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const leadsRoutes = new OpenAPIHono<HonoEnv>();

const ListQuery = PaginationQuery.extend({
  status: LeadStatus.optional(),
  funnel_id: z.string().optional(),
  min_score: z.coerce.number().int().min(0).max(100).optional(),
});

leadsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Leads"],
    summary: "List leads",
    request: { query: ListQuery },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Lead)) },
  }),
  async (c) => {
    const q = c.req.valid("query");
    const page = await leadService.list({
      workspaceId: c.get("apiKey").workspace_id,
      ...q,
    });
    return c.json(page, 200);
  },
);

leadsRoutes.openapi(
  route({
    method: "post",
    path: "/",
    tags: ["Leads"],
    summary: "Capture a new lead (for external lead sources)",
    request: { body: jsonBody(CreateLead) },
    responses: { 201: jsonResponse("Created", Lead) },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const lead = await leadService.capture({
      workspaceId: c.get("apiKey").workspace_id,
      ...body,
      ip: c.req.header("cf-connecting-ip") ?? null,
      user_agent: c.req.header("user-agent") ?? null,
    });
    return c.json(lead, 201);
  },
);

leadsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}",
    tags: ["Leads"],
    summary: "Retrieve a lead",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Lead) },
  }),
  async (c) => {
    const lead = await leadService.get({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(lead, 200);
  },
);

leadsRoutes.openapi(
  route({
    method: "patch",
    path: "/{id}",
    tags: ["Leads"],
    summary: "Update a lead's score, status, or custom fields",
    request: { params: idParam, body: jsonBody(UpdateLead) },
    responses: { 200: jsonResponse("OK", Lead) },
  }),
  async (c) => {
    const lead = await leadService.update({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
      patch: c.req.valid("json"),
    });
    return c.json(lead, 200);
  },
);

leadsRoutes.openapi(
  route({
    method: "post",
    path: "/{id}/qualify",
    tags: ["Leads"],
    summary: "Run the qualification pipeline against a lead",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Lead) },
  }),
  async (c) => {
    const lead = await leadService.qualify({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(lead, 200);
  },
);
