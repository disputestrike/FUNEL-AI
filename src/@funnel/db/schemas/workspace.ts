import { z } from "zod";
import { id, isoDateTime, isoDateTimeNullable, jsonObject } from "./common.js";

export const WorkspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "editor",
  "analyst",
  "viewer",
  "billing",
]);

export const WorkspaceStatusSchema = z.enum(["active", "suspended", "closed"]);

export const WorkspaceSchema = z.object({
  id: id("workspace"),
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/i, "invalid slug"),
  name: z.string().min(1).max(200),
  ownerUserId: id("user"),
  plan: z.string().min(1).max(64).default("trial"),
  status: WorkspaceStatusSchema.default("active"),
  vertical: z.string().max(64).nullable().optional(),
  region: z.string().min(1).max(32).default("us-east-1"),
  dataResidencyLock: z.boolean().default(false),
  brandColors: jsonObject.default({}),
  featureFlags: jsonObject.default({}),
  aiTrainingOptIn: z.boolean().default(false),
  closedAt: isoDateTimeNullable,
  closedReason: z.string().max(500).nullable().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const CreateWorkspaceSchema = WorkspaceSchema.pick({
  id: true,
  slug: true,
  name: true,
  ownerUserId: true,
  plan: true,
  vertical: true,
  region: true,
  brandColors: true,
  featureFlags: true,
});

export const WorkspaceMemberSchema = z.object({
  id: id("workspaceMember"),
  workspaceId: id("workspace"),
  userId: id("user"),
  role: WorkspaceRoleSchema,
  invitedBy: id("user").nullable().optional(),
  invitedAt: isoDateTimeNullable,
  joinedAt: isoDateTimeNullable,
  removedAt: isoDateTimeNullable,
  removedBy: id("user").nullable().optional(),
  lastSeenAt: isoDateTimeNullable,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
