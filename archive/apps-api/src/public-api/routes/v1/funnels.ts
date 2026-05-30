/**
 * /v1/funnels — public REST surface for the Funnels resource.
 *
 * Mirrors the internal `funnel` tRPC router but with stable field names and
 * versioned semantics. List endpoint paginates via opaque cursors.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { funnelService } from "@funnel/orchestrator";
import type { HonoEnv } from "../../../lib/context.js";
import {
  Funnel,
  CreateFunnel,
  UpdateFunnel,
} from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonBody, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const funnelsRoutes = new OpenAPIHono<HonoEnv>();

/* list */
funnelsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Funnels"],
    summary: "List funnels",
    request: { query: PaginationQuery },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Funnel)) },
  }),
  async (c) => {
    const { cursor, limit } = c.req.valid("query");
    const page = await funnelService.list({
      workspaceId: c.get("apiKey").workspace_id,
      cursor,
      limit,
    });
    return c.json(page, 200);
  },
);

/* create */
funnelsRoutes.openapi(
  route({
    method: "post",
    path: "/",
    tags: ["Funnels"],
    summary: "Create a funnel (optionally AI-generated from a brief)",
    request: { body: jsonBody(CreateFunnel) },
    responses: { 201: jsonResponse("Created", Funnel) },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const funnel = await funnelService.create({
      workspaceId: c.get("apiKey").workspace_id,
      ...body,
    });
    return c.json(funnel, 201);
  },
);

/* retrieve */
funnelsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}",
    tags: ["Funnels"],
    summary: "Retrieve a funnel",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Funnel) },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const funnel = await funnelService.get({
      workspaceId: c.get("apiKey").workspace_id,
      id,
    });
    return c.json(funnel, 200);
  },
);

/* update */
funnelsRoutes.openapi(
  route({
    method: "patch",
    path: "/{id}",
    tags: ["Funnels"],
    summary: "Update a funnel",
    request: { params: idParam, body: jsonBody(UpdateFunnel) },
    responses: { 200: jsonResponse("OK", Funnel) },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const patch = c.req.valid("json");
    const funnel = await funnelService.update({
      workspaceId: c.get("apiKey").workspace_id,
      id,
      patch,
    });
    return c.json(funnel, 200);
  },
);

/* delete */
funnelsRoutes.openapi(
  route({
    method: "delete",
    path: "/{id}",
    tags: ["Funnels"],
    summary: "Delete a funnel",
    request: { params: idParam },
    responses: { 204: { description: "Deleted" } },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    await funnelService.archive({
      workspaceId: c.get("apiKey").workspace_id,
      id,
    });
    return c.body(null, 204);
  },
);

/* publish */
funnelsRoutes.openapi(
  route({
    method: "post",
    path: "/{id}/publish",
    tags: ["Funnels"],
    summary: "Publish a funnel to its production URL",
    request: { params: idParam },
    responses: { 200: jsonResponse("Published", Funnel) },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const funnel = await funnelService.publish({
      workspaceId: c.get("apiKey").workspace_id,
      id,
    });
    return c.json(funnel, 200);
  },
);

/* regenerate */
funnelsRoutes.openapi(
  route({
    method: "post",
    path: "/{id}/regenerate",
    tags: ["Funnels"],
    summary: "Regenerate funnel content from a new brief",
    request: {
      params: idParam,
      body: jsonBody(z.object({ brief: z.string().min(1), preserve_branding: z.boolean().default(true) })),
    },
    responses: { 202: jsonResponse("Accepted", z.object({ job_id: z.string() })) },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const job = await funnelService.regenerate({
      workspaceId: c.get("apiKey").workspace_id,
      id,
      brief: body.brief,
      preserveBranding: body.preserve_branding,
    });
    return c.json({ job_id: job.id }, 202);
  },
);
