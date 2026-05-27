/**
 * /v1/voice-calls — read-only access to RevTry AI voice agent activity.
 *
 * Recording URLs are short-lived (15min) signed URLs into the
 * @funnel/revtry storage bucket. Transcript is paginated by segment.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { revtryService } from "@funnel/revtry";
import type { HonoEnv } from "../../../lib/context.js";
import { VoiceCall, Transcript } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const voiceCallsRoutes = new OpenAPIHono<HonoEnv>();

voiceCallsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["VoiceCalls"],
    summary: "List voice calls",
    request: {
      query: PaginationQuery.extend({
        lead_id: z.string().optional(),
        direction: z.enum(["inbound", "outbound"]).optional(),
      }),
    },
    responses: { 200: jsonResponse("OK", PaginatedResponse(VoiceCall)) },
  }),
  async (c) => {
    const page = await revtryService.listCalls({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json(page, 200);
  },
);

voiceCallsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}",
    tags: ["VoiceCalls"],
    summary: "Retrieve a voice call",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", VoiceCall) },
  }),
  async (c) => {
    const call = await revtryService.getCall({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(call, 200);
  },
);

voiceCallsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}/transcript",
    tags: ["VoiceCalls"],
    summary: "Get the call transcript",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Transcript) },
  }),
  async (c) => {
    const transcript = await revtryService.getTranscript({
      workspaceId: c.get("apiKey").workspace_id,
      callId: c.req.valid("param").id,
    });
    return c.json(transcript, 200);
  },
);

voiceCallsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}/recording",
    tags: ["VoiceCalls"],
    summary: "Get a signed URL for the call recording (15min TTL)",
    request: { params: idParam },
    responses: {
      200: jsonResponse(
        "OK",
        z.object({ url: z.string().url(), expires_at: z.string().datetime() }),
      ),
    },
  }),
  async (c) => {
    const { url, expiresAt } = await revtryService.signRecordingUrl({
      workspaceId: c.get("apiKey").workspace_id,
      callId: c.req.valid("param").id,
      ttlSec: 15 * 60,
    });
    return c.json({ url, expires_at: expiresAt }, 200);
  },
);
