import { z } from "zod";
import {
  id,
  isoDateTime,
  isoDateTimeNullable,
  jsonObject,
} from "./common.js";

export const IntegrationConnectionSchema = z.object({
  id: id("integration"),
  workspaceId: id("workspace"),
  provider: z.enum([
    "stripe",
    "google_calendar",
    "meta_ads",
    "google_ads",
    "hubspot",
    "signalwire",
    "resend",
    "salesforce",
    "zapier",
    "slack",
    "outlook",
    "calendly",
  ]),
  externalAccountId: z.string().max(200).nullable().optional(),
  displayName: z.string().max(200).nullable().optional(),
  scopes: z.array(z.string().max(120)).default([]),
  credentialsKmsArn: z.string().min(1).max(2048),
  vaultPath: z.string().min(1).max(500),
  status: z.enum(["active", "expired", "revoked", "error"]).default("active"),
  connectedBy: id("user"),
  connectedAt: isoDateTime,
  lastSyncAt: isoDateTimeNullable,
  lastError: z.string().max(2000).nullable().optional(),
  metadata: jsonObject.default({}),
  disconnectedAt: isoDateTimeNullable,
  disconnectedBy: id("user").nullable().optional(),
});

export const ApiKeySchema = z.object({
  id: id("apiKey"),
  workspaceId: id("workspace"),
  name: z.string().min(1).max(120),
  keyPrefix: z.string().min(1).max(64),
  keyHash: z.string().length(64),
  scopes: z.array(z.string().max(64)).default([]),
  createdBy: id("user"),
  lastUsedAt: isoDateTimeNullable,
  lastUsedIpHash: z.string().max(128).nullable().optional(),
  expiresAt: isoDateTimeNullable,
  revokedAt: isoDateTimeNullable,
  revokedBy: id("user").nullable().optional(),
  createdAt: isoDateTime,
});

export const WebhookSchema = z.object({
  id: id("webhook"),
  workspaceId: id("workspace"),
  url: z.string().url().max(2048),
  secretHash: z.string().length(64),
  events: z.array(z.string().min(1).max(120)).min(1),
  active: z.boolean().default(true),
  description: z.string().max(500).nullable().optional(),
  lastDeliveryAt: isoDateTimeNullable,
  lastFailureAt: isoDateTimeNullable,
  consecutiveFailures: z.number().int().nonnegative().default(0),
  createdBy: id("user"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export type IntegrationConnection = z.infer<typeof IntegrationConnectionSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type Webhook = z.infer<typeof WebhookSchema>;
