/**
 * /v1/bookings — calendar bookings tied to leads/contacts.
 * Creates fan out to the connected calendar provider (Google / Microsoft / Cal.com).
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { bookingService } from "@funnel/integrations";
import type { HonoEnv } from "../../../lib/context.js";
import { Booking, CreateBooking } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonBody, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const bookingsRoutes = new OpenAPIHono<HonoEnv>();

bookingsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Bookings"],
    summary: "List bookings",
    request: {
      query: PaginationQuery.extend({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      }),
    },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Booking)) },
  }),
  async (c) => {
    const page = await bookingService.list({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("query"),
    });
    return c.json(page, 200);
  },
);

bookingsRoutes.openapi(
  route({
    method: "post",
    path: "/",
    tags: ["Bookings"],
    summary: "Create a booking (syncs to connected calendar)",
    request: { body: jsonBody(CreateBooking) },
    responses: { 201: jsonResponse("Created", Booking) },
  }),
  async (c) => {
    const booking = await bookingService.create({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("json"),
    });
    return c.json(booking, 201);
  },
);

bookingsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}",
    tags: ["Bookings"],
    summary: "Retrieve a booking",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Booking) },
  }),
  async (c) => {
    const booking = await bookingService.get({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(booking, 200);
  },
);

bookingsRoutes.openapi(
  route({
    method: "patch",
    path: "/{id}",
    tags: ["Bookings"],
    summary: "Reschedule a booking",
    request: {
      params: idParam,
      body: jsonBody(
        z.object({
          starts_at: z.string().datetime(),
          ends_at: z.string().datetime(),
        }),
      ),
    },
    responses: { 200: jsonResponse("OK", Booking) },
  }),
  async (c) => {
    const booking = await bookingService.reschedule({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
      ...c.req.valid("json"),
    });
    return c.json(booking, 200);
  },
);

bookingsRoutes.openapi(
  route({
    method: "delete",
    path: "/{id}",
    tags: ["Bookings"],
    summary: "Cancel a booking",
    request: { params: idParam },
    responses: { 204: { description: "Cancelled" } },
  }),
  async (c) => {
    await bookingService.cancel({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.body(null, 204);
  },
);
