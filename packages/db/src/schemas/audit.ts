import { z } from "zod";
import {
  id,
  isoDateTime,
  jsonObject,
  piiTier,
} from "./common.js";

export const AuditLogSchema = z.object({
  id: id("auditLog"),
  workspaceId: id("workspace").nullable().optional(),
  actorUserId: id("user").nullable().optional(),
  impersonatorUserId: id("user").nullable().optional(),
  action: z.string().min(1).max(120),
  subjectType: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(64),
  beforeBlob: jsonObject.nullable().optional(),
  afterBlob: jsonObject.nullable().optional(),
  diff: jsonObject.nullable().optional(),
  ipHash: z.string().max(128).nullable().optional(),
  userAgent: z.string().max(1024).nullable().optional(),
  requestId: z.string().max(128).nullable().optional(),
  traceId: z.string().max(128).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  piiTier: piiTier.default("P1"),
  occurredAt: isoDateTime,
});

export const CreateAuditLogSchema = AuditLogSchema.pick({
  id: true,
  workspaceId: true,
  actorUserId: true,
  impersonatorUserId: true,
  action: true,
  subjectType: true,
  subjectId: true,
  beforeBlob: true,
  afterBlob: true,
  diff: true,
  ipHash: true,
  userAgent: true,
  requestId: true,
  traceId: true,
  reason: true,
  piiTier: true,
});

export const EventLogSchema = z.object({
  eventId: id("eventLog"),
  eventName: z.string().min(1).max(120),
  eventFamily: z.enum([
    "identity",
    "generation",
    "publish",
    "distribution",
    "lead",
    "revenue_funnel",
    "revenue_saas",
    "support",
    "governance",
  ]),
  schemaVersion: z.number().int().min(1),
  workspaceId: id("workspace").nullable().optional(),
  actorType: z.enum(["user", "agent", "system", "admin", "anonymous"]),
  actorUserId: id("user").nullable().optional(),
  agentId: z.string().max(120).nullable().optional(),
  impersonatorUserId: id("user").nullable().optional(),
  subjectType: z.string().max(64).nullable().optional(),
  subjectId: z.string().max(64).nullable().optional(),
  piiTier,
  properties: jsonObject,
  context: jsonObject.default({}),
  consent: jsonObject.default({}),
  producer: jsonObject,
  occurredAt: isoDateTime,
  receivedAt: isoDateTime,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
export type EventLog = z.infer<typeof EventLogSchema>;
