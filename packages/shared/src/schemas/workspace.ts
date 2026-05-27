/**
 * Zod schemas for Workspace, WorkspaceMember.
 *
 * Mirrors `types/workspace.ts`. Use these to validate API request payloads
 * and persistence rows.
 */

import { z } from "zod";

export const RoleSchema = z.enum(["owner", "admin", "editor", "analyst", "viewer", "billing"]);

export const PlanSlugSchema = z.enum(["free", "starter", "growth", "scale", "agency"]);

export const RegionSchema = z.enum([
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-south-1",
  "ap-southeast-2",
  "sa-east-1",
]);

export const WorkspaceBrandColorsSchema = z
  .object({
    primary_500: z.string().optional(),
    secondary_500: z.string().optional(),
    accent_500: z.string().optional(),
  })
  .strict();

export const WorkspaceFeatureFlagsSchema = z
  .object({
    enable_ad_publishing: z.boolean().optional(),
    enable_revtry: z.boolean().optional(),
    default_persona_slug: z.string().optional(),
  })
  .catchall(z.unknown());

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  owner_user_id: z.string().min(1),
  plan: PlanSlugSchema,
  vertical: z.string().optional(),
  region: RegionSchema,
  data_residency_lock: z.boolean(),
  brand_colors: WorkspaceBrandColorsSchema,
  feature_flags: WorkspaceFeatureFlagsSchema,
  ai_training_opt_in: z.boolean(),
  closed_at: z.string().datetime().nullable().optional(),
  closed_reason: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable().optional(),
});

export const WorkspaceMemberSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  user_id: z.string().min(1),
  role: RoleSchema,
  invited_by: z.string().nullable().optional(),
  invited_at: z.string().datetime().nullable().optional(),
  joined_at: z.string().datetime().nullable().optional(),
  removed_at: z.string().datetime().nullable().optional(),
  removed_by: z.string().nullable().optional(),
  last_seen_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type WorkspaceInput = z.input<typeof WorkspaceSchema>;
export type WorkspaceParsed = z.output<typeof WorkspaceSchema>;
