/**
 * Workspace domain types.
 *
 * A workspace is the tenant boundary of GoFunnelAI. Every workspace-scoped row
 * carries `workspace_id` for RLS isolation. Members are users granted a role
 * inside a workspace.
 *
 * IDs are ULIDs, prefixed (`wsp_`, `wsm_`, `usr_`). See `utils/id.ts`.
 */

export type WorkspaceId = string;
export type WorkspaceMemberId = string;
export type UserId = string;

/**
 * Roles control authorization inside a workspace. Ordered loosely by power
 * (owner is the only role that can transfer ownership or close the workspace).
 */
export enum Role {
  Owner = "owner",
  Admin = "admin",
  Editor = "editor",
  Analyst = "analyst",
  Viewer = "viewer",
  Billing = "billing",
}

/**
 * Plan slugs match `PLANS` in `constants/plans.ts`.
 */
export type PlanSlug = "free" | "starter" | "growth" | "scale" | "agency";

/**
 * Region pins data residency. Values are AWS-style region codes.
 */
export type Region =
  | "us-east-1"
  | "us-west-2"
  | "eu-west-1"
  | "eu-central-1"
  | "ap-south-1"
  | "ap-southeast-2"
  | "sa-east-1";

/**
 * Workspace brand colors are a small per-tenant override layer that the
 * AI generation engine reads. Full BrandTokens live on each Funnel.
 */
export interface WorkspaceBrandColors {
  primary_500?: string;
  secondary_500?: string;
  accent_500?: string;
}

export interface WorkspaceFeatureFlags {
  /** Allow agents in this workspace to call out to real ad platforms. */
  enable_ad_publishing?: boolean;
  /** Enable the RevTry outbound calling worker for this workspace. */
  enable_revtry?: boolean;
  /** Default voice persona for generated content. */
  default_persona_slug?: string;
  /** Arbitrary forward-compatible flags. */
  [key: string]: unknown;
}

export interface Workspace {
  id: WorkspaceId;
  slug: string;
  name: string;
  owner_user_id: UserId;
  plan: PlanSlug;
  vertical?: string; // industry slug; see `INDUSTRIES`
  region: Region;
  data_residency_lock: boolean;
  brand_colors: WorkspaceBrandColors;
  feature_flags: WorkspaceFeatureFlags;
  ai_training_opt_in: boolean;
  closed_at?: string | null; // ISO-8601
  closed_reason?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface WorkspaceMember {
  id: WorkspaceMemberId;
  workspace_id: WorkspaceId;
  user_id: UserId;
  role: Role;
  invited_by?: UserId | null;
  invited_at?: string | null;
  joined_at?: string | null;
  removed_at?: string | null;
  removed_by?: UserId | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}
