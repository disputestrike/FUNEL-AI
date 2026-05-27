import { z } from "zod";

const userId = z.string().min(1);
const workspaceId = z.string().min(1);
const email_hash = z.string().min(8);

export const Schemas = {
  user_signed_up: z.object({ user_id: userId, email_hash, email_domain: z.string(), source: z.string() }),
  user_email_verified: z.object({ user_id: userId, email_hash }),
  user_logged_in: z.object({ user_id: userId, session_id: z.string(), method: z.string(), mfa_used: z.boolean(), new_device: z.boolean() }),
  user_login_failed: z.object({ email_hash, reason: z.string() }),
  user_logged_out: z.object({ user_id: userId, session_id: z.string(), reason: z.string() }),
  user_password_reset_requested: z.object({ user_id: userId.nullable(), email_hash }),
  user_password_changed: z.object({ user_id: userId, via: z.string(), sessions_invalidated: z.number().int().nonnegative() }),
  user_mfa_enrolled: z.object({ user_id: userId, factor: z.string() }),
  user_mfa_disabled: z.object({ user_id: userId, factor: z.string() }),
  user_email_changed: z.object({ user_id: userId, old_email_hash: email_hash, new_email_hash: email_hash }),
  user_account_archived: z.object({ user_id: userId, reason: z.string().nullable() }),
  user_account_restored: z.object({ user_id: userId }),
  workspace_created: z.object({ workspace_id: workspaceId, owner_user_id: userId, plan: z.string() }),
  workspace_member_invited: z.object({ workspace_id: workspaceId, invited_email_hash: email_hash, role: z.string(), invited_by: userId }),
  workspace_member_joined: z.object({ workspace_id: workspaceId, user_id: userId, role: z.string() }),
  workspace_member_removed: z.object({ workspace_id: workspaceId, user_id: userId }),
  workspace_member_role_changed: z.object({ workspace_id: workspaceId, user_id: userId, from_role: z.string(), to_role: z.string() }),
  workspace_ownership_transferred: z.object({ workspace_id: workspaceId, from_user_id: userId, to_user_id: userId, effective_at: z.string() }),
  workspace_closed: z.object({ workspace_id: workspaceId, reason: z.string().nullable(), purge_after: z.string() }),
  api_key_created: z.object({ workspace_id: workspaceId, api_key_id: z.string(), prefix: z.string(), created_by: userId }),
  api_key_revoked: z.object({ workspace_id: workspaceId, api_key_id: z.string(), revoked_by: userId }),
} as const;
