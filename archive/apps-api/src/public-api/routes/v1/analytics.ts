/**
 * /v1/analytics — read-only aggregates over the workspace's data warehouse.
 * Backed by the materialized rollups in @funnel/events.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { analyticsService } from "@funnel/events";
import type { HonoEnv } from "../../../lib/context.js";
import {
  AnalyticsRange,
  CohortRow,
  RetentionPoint,
  ConversionFunnelStep,
  RevenuePoint,
} from "../../lib/schemas.js";
import { route, jsonResponse } from "../../lib/route-helpers.js";

export const analyticsRoutes = new OpenAPIHono<HonoEnv>();

analyticsRoutes.openapi(
  route({
    method: "get",
    path: "/cohorts",
    tags: ["Analytics"],
    summary: "Cohort retention matrix",
    request: { query: AnalyticsRange },
    responses: { 200: jsonResponse("OK", z.object({ cohorts: z.array(CohortRow) })) },
  }),
  async (c) => {
    const data = await analyticsService.cohorts({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json({ cohorts: data }, 200);
  },
);

analyticsRoutes.openapi(
  route({
    method: "get",
    path: "/retention",
    tags: ["Analytics"],
    summary: "Retention curve",
    request: { query: AnalyticsRange },
    responses: { 200: jsonResponse("OK", z.object({ points: z.array(RetentionPoint) })) },
  }),
  async (c) => {
    const data = await analyticsService.retention({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json({ points: data }, 200);
  },
);

analyticsRoutes.openapi(
  route({
    method: "get",
    path: "/conversion",
    tags: ["Analytics"],
    summary: "Conversion funnel steps",
    request: { query: AnalyticsRange.extend({ funnel_id: z.string().optional() }) },
    responses: { 200: jsonResponse("OK", z.object({ steps: z.array(ConversionFunnelStep) })) },
  }),
  async (c) => {
    const data = await analyticsService.conversion({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json({ steps: data }, 200);
  },
);

analyticsRoutes.openapi(
  route({
    method: "get",
    path: "/revenue",
    tags: ["Analytics"],
    summary: "Revenue time series",
    request: { query: AnalyticsRange },
    responses: { 200: jsonResponse("OK", z.object({ points: z.array(RevenuePoint) })) },
  }),
  async (c) => {
    const data = await analyticsService.revenue({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json({ points: data }, 200);
  },
);
