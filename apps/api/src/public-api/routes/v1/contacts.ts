/**
 * /v1/contacts — full CRUD over the CRM contact entity.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { contactService } from "@funnel/crm";
import type { HonoEnv } from "../../../lib/context.js";
import { Contact, CreateContact, UpdateContact } from "../../lib/schemas.js";
import { PaginatedResponse, PaginationQuery } from "../../lib/types.js";
import { route, jsonBody, jsonResponse, idParam } from "../../lib/route-helpers.js";

export const contactsRoutes = new OpenAPIHono<HonoEnv>();

contactsRoutes.openapi(
  route({
    method: "get",
    path: "/",
    tags: ["Contacts"],
    summary: "List contacts",
    request: { query: PaginationQuery },
    responses: { 200: jsonResponse("OK", PaginatedResponse(Contact)) },
  }),
  async (c) => {
    const q = c.req.valid("query");
    const page = await contactService.list({
      workspaceId: c.get("apiKey").workspace_id,
      ...q,
    });
    return c.json(page, 200);
  },
);

contactsRoutes.openapi(
  route({
    method: "post",
    path: "/",
    tags: ["Contacts"],
    summary: "Create a contact",
    request: { body: jsonBody(CreateContact) },
    responses: { 201: jsonResponse("Created", Contact) },
  }),
  async (c) => {
    const contact = await contactService.create({
      workspaceId: c.get("apiKey").workspace_id,
      ...c.req.valid("json"),
    });
    return c.json(contact, 201);
  },
);

contactsRoutes.openapi(
  route({
    method: "get",
    path: "/{id}",
    tags: ["Contacts"],
    summary: "Retrieve a contact",
    request: { params: idParam },
    responses: { 200: jsonResponse("OK", Contact) },
  }),
  async (c) => {
    const contact = await contactService.get({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.json(contact, 200);
  },
);

contactsRoutes.openapi(
  route({
    method: "patch",
    path: "/{id}",
    tags: ["Contacts"],
    summary: "Update a contact",
    request: { params: idParam, body: jsonBody(UpdateContact) },
    responses: { 200: jsonResponse("OK", Contact) },
  }),
  async (c) => {
    const contact = await contactService.update({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
      patch: c.req.valid("json"),
    });
    return c.json(contact, 200);
  },
);

contactsRoutes.openapi(
  route({
    method: "delete",
    path: "/{id}",
    tags: ["Contacts"],
    summary: "Delete a contact",
    request: { params: idParam },
    responses: { 204: { description: "Deleted" } },
  }),
  async (c) => {
    await contactService.delete({
      workspaceId: c.get("apiKey").workspace_id,
      id: c.req.valid("param").id,
    });
    return c.body(null, 204);
  },
);
