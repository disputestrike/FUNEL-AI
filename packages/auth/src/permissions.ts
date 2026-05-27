/**
 * Workspace role × permission matrix.
 *
 * The matrix is exhaustive — `requirePermission` returns 403 for any
 * combination that isn't an explicit ✅ here. This makes "deny by default"
 * mechanical and audit-friendly.
 *
 * "client-view" maps to the `Viewer` role in `@funnel/shared` (we name it
 * `Viewer` in code; "client-view" is the marketing-facing label for the
 * agency add-on tier). It has the same permission bitset.
 */

import { Role } from "@funnel/shared";
import { Errors } from "./errors.js";
import type { AuthContext } from "./internal/ports.js";
import type {
  PermissionAction,
  PermissionCheckResult,
  PermissionResource,
} from "./types.js";

type Matrix = Record<Role, Partial<Record<PermissionResource, ReadonlyArray<PermissionAction>>>>;

const ALL: ReadonlyArray<PermissionAction> = [
  "read",
  "create",
  "update",
  "delete",
  "publish",
  "invite",
  "transfer",
  "manage_billing",
  "manage_api_keys",
  "impersonate",
];

export const ROLE_MATRIX: Matrix = {
  [Role.Owner]: {
    workspace: ["read", "update", "delete", "transfer"],
    "workspace.members": ["read", "invite", "update", "delete"],
    "workspace.billing": ["read", "manage_billing"],
    "workspace.api_keys": ["read", "create", "update", "delete", "manage_api_keys"],
    funnel: ALL,
    lead: ALL,
    contact: ALL,
    audit_log: ["read"],
  },
  [Role.Admin]: {
    workspace: ["read", "update"],
    "workspace.members": ["read", "invite", "update"],
    "workspace.billing": ["read", "manage_billing"],
    "workspace.api_keys": ["read", "create", "update", "delete", "manage_api_keys"],
    funnel: ["read", "create", "update", "delete", "publish"],
    lead: ["read", "create", "update", "delete"],
    contact: ["read", "create", "update", "delete"],
    audit_log: ["read"],
  },
  [Role.Editor]: {
    workspace: ["read"],
    "workspace.members": ["read"],
    funnel: ["read", "create", "update", "publish"],
    lead: ["read", "create", "update"],
    contact: ["read", "create", "update"],
  },
  [Role.Analyst]: {
    workspace: ["read"],
    funnel: ["read"],
    lead: ["read"],
    contact: ["read"],
  },
  [Role.Viewer]: {
    workspace: ["read"],
    funnel: ["read"],
    lead: ["read"],
    contact: ["read"],
  },
  [Role.Billing]: {
    workspace: ["read"],
    "workspace.billing": ["read", "manage_billing"],
    audit_log: ["read"],
  },
};

export function can(role: Role, resource: PermissionResource, action: PermissionAction): boolean {
  const cell = ROLE_MATRIX[role]?.[resource];
  if (!cell) return false;
  return cell.includes(action);
}

export async function requirePermission(
  ctx: AuthContext,
  args: {
    workspace_id: string;
    user_id: string;
    resource: PermissionResource;
    action: PermissionAction;
  },
): Promise<PermissionCheckResult> {
  if (await ctx.workspaces.isClosed(args.workspace_id)) {
    throw Errors.workspaceClosed();
  }
  const member = await ctx.workspaces.getMember(args.workspace_id, args.user_id);
  if (!member || member.removed_at) {
    throw Errors.permissionDenied(args.resource, args.action);
  }
  if (!can(member.role, args.resource, args.action)) {
    throw Errors.permissionDenied(args.resource, args.action);
  }
  return { allowed: true, role: member.role };
}

/**
 * RLS context. Every DB call MUST run with `current_setting('app.workspace_id')`
 * set to the active workspace; this helper builds the `SET LOCAL` payload.
 * `@funnel/db` reads it and configures the Postgres session.
 */
export function buildRlsContext(args: {
  workspace_id: string | null;
  user_id: string | null;
  admin: boolean;
  impersonator_user_id?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (args.workspace_id) out["app.workspace_id"] = args.workspace_id;
  if (args.user_id) out["app.user_id"] = args.user_id;
  out["app.admin"] = args.admin ? "true" : "false";
  if (args.impersonator_user_id) out["app.impersonator_user_id"] = args.impersonator_user_id;
  return out;
}
