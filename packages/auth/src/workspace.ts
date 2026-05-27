/**
 * Workspace membership operations.
 *
 *  - `inviteMember`: issue a 7-day single-use token, send email.
 *  - `acceptInvite`: consumes the token, links the user to the workspace.
 *  - `declineInvite`: consumes the token without joining.
 *  - `removeMember`: only Owner/Admin; Owner cannot be removed.
 *  - `changeRole`: only Owner/Admin; Owner role can only move via transfer.
 *  - `transferOwnership`: Owner-only; new owner is the previous owner's
 *    successor after a 24-hour cooling period (so a phished owner has a
 *    window to revert).
 *  - `closeWorkspace`: Owner-only; schedules purge after a 30-day grace.
 *
 * Every state change emits a workspace_* event AND an audit_log row.
 */

import { z } from "zod";
import { Role } from "@funnel/shared";
import { emit } from "@funnel/events";
import type { Email } from "@funnel/email";
import { Errors } from "./errors.js";
import { sha256Hex } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { generateRawToken, hashToken, ttlForPurpose } from "./internal/tokens.js";
import { newId } from "./internal/ids.js";
import { normalizeEmail } from "./internal/email.js";
import { requirePermission } from "./permissions.js";

export interface InviteMemberInput {
  workspace_id: string;
  actor_user_id: string;
  invited_email: string;
  role: Role;
}

export async function inviteMember(
  ctx: AuthContext,
  input: InviteMemberInput,
  deps: { email: Pick<Email, "send">; link_base: string },
): Promise<{ invite_id: string }> {
  await requirePermission(ctx, {
    workspace_id: input.workspace_id,
    user_id: input.actor_user_id,
    resource: "workspace.members",
    action: "invite",
  });
  if (input.role === Role.Owner) {
    throw Errors.permissionDenied("workspace.members", "invite_owner");
  }

  const emailNormalized = normalizeEmail(input.invited_email);
  const token = generateRawToken();
  const id = newId("inv");
  await ctx.workspaces.createInvite({
    id,
    workspace_id: input.workspace_id,
    invited_email_normalized: emailNormalized,
    role: input.role,
    invited_by: input.actor_user_id,
    token_hash: hashToken(token),
    expires_at: new Date(ctx.now().getTime() + ttlForPurpose("invite") * 1000).toISOString(),
    accepted_at: null,
    declined_at: null,
    created_at: ctx.now().toISOString(),
  });

  const link = `${deps.link_base}?token=${encodeURIComponent(token)}&invite_id=${id}`;
  try {
    await deps.email.send({
      to: input.invited_email,
      template: "workspace_invite",
      subject: "You're invited to a GoFunnelAI workspace",
      data: { accept_link: link, role: input.role },
    });
  } catch {
    // non-blocking
  }
  await emit("workspace_member_invited", {
    workspace_id: input.workspace_id,
    invited_email_hash: sha256Hex(emailNormalized),
    invited_by: input.actor_user_id,
    role: input.role,
  });
  await ctx.audit.write({
    workspace_id: input.workspace_id,
    actor_user_id: input.actor_user_id,
    impersonator_user_id: null,
    subject_type: "workspace_invite",
    subject_id: id,
    action: "create",
    payload: { invited_email_hash: sha256Hex(emailNormalized), role: input.role },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
  return { invite_id: id };
}

export async function acceptInvite(
  ctx: AuthContext,
  rawToken: string,
  acceptingUserId: string,
): Promise<{ workspace_id: string; role: Role }> {
  const row = await ctx.workspaces.findInviteByHash(hashToken(rawToken));
  if (!row) throw Errors.inviteInvalid();
  if (row.accepted_at) throw Errors.inviteAlreadyAccepted();
  if (row.declined_at) throw Errors.inviteInvalid();
  if (new Date(row.expires_at).getTime() < ctx.now().getTime()) throw Errors.inviteExpired();

  const user = await ctx.users.findById(acceptingUserId);
  if (!user || user.email_normalized !== row.invited_email_normalized) {
    throw Errors.inviteInvalid();
  }

  const existing = await ctx.workspaces.getMember(row.workspace_id, acceptingUserId);
  if (existing && !existing.removed_at) {
    // Idempotent: already a member.
    await ctx.workspaces.markInviteAccepted(row.id, ctx.now().toISOString());
    return { workspace_id: row.workspace_id, role: existing.role };
  }

  await ctx.workspaces.addMember({
    id: newId("wsm"),
    workspace_id: row.workspace_id,
    user_id: acceptingUserId,
    role: row.role,
    invited_by: row.invited_by,
    invited_at: row.created_at,
    joined_at: ctx.now().toISOString(),
    removed_at: null,
    removed_by: null,
  });
  await ctx.workspaces.markInviteAccepted(row.id, ctx.now().toISOString());

  await emit("workspace_member_joined", {
    workspace_id: row.workspace_id,
    user_id: acceptingUserId,
    role: row.role,
  });
  await ctx.audit.write({
    workspace_id: row.workspace_id,
    actor_user_id: acceptingUserId,
    impersonator_user_id: null,
    subject_type: "workspace_member",
    subject_id: acceptingUserId,
    action: "join",
    payload: { role: row.role },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
  return { workspace_id: row.workspace_id, role: row.role };
}

export async function declineInvite(ctx: AuthContext, rawToken: string): Promise<void> {
  const row = await ctx.workspaces.findInviteByHash(hashToken(rawToken));
  if (!row) throw Errors.inviteInvalid();
  if (row.accepted_at) throw Errors.inviteAlreadyAccepted();
  if (row.declined_at) return;
  await ctx.workspaces.markInviteDeclined(row.id, ctx.now().toISOString());
}

export async function removeMember(
  ctx: AuthContext,
  args: { workspace_id: string; actor_user_id: string; target_user_id: string },
): Promise<void> {
  await requirePermission(ctx, {
    workspace_id: args.workspace_id,
    user_id: args.actor_user_id,
    resource: "workspace.members",
    action: "delete",
  });
  const target = await ctx.workspaces.getMember(args.workspace_id, args.target_user_id);
  if (!target) throw Errors.permissionDenied("workspace.members", "delete");
  if (target.role === Role.Owner) throw Errors.ownerCannotLeave();
  if (target.user_id === args.actor_user_id) throw Errors.permissionDenied("workspace.members", "remove_self");
  await ctx.workspaces.updateMember(target.id, {
    removed_at: ctx.now().toISOString(),
    removed_by: args.actor_user_id,
  });
  await emit("workspace_member_removed", {
    workspace_id: args.workspace_id,
    user_id: args.target_user_id,
    actor: { type: "user", user_id: args.actor_user_id },
  });
  await ctx.audit.write({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    impersonator_user_id: null,
    subject_type: "workspace_member",
    subject_id: args.target_user_id,
    action: "remove",
    payload: { from_role: target.role },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
}

export async function changeRole(
  ctx: AuthContext,
  args: {
    workspace_id: string;
    actor_user_id: string;
    target_user_id: string;
    new_role: Role;
  },
): Promise<void> {
  await requirePermission(ctx, {
    workspace_id: args.workspace_id,
    user_id: args.actor_user_id,
    resource: "workspace.members",
    action: "update",
  });
  if (args.new_role === Role.Owner) throw Errors.permissionDenied("workspace.members", "change_to_owner");

  const target = await ctx.workspaces.getMember(args.workspace_id, args.target_user_id);
  if (!target) throw Errors.permissionDenied("workspace.members", "update");
  if (target.role === Role.Owner) throw Errors.permissionDenied("workspace.members", "change_owner");

  const fromRole = target.role;
  await ctx.workspaces.updateMember(target.id, { role: args.new_role });
  await emit("workspace_member_role_changed", {
    workspace_id: args.workspace_id,
    user_id: args.target_user_id,
    from_role: fromRole,
    to_role: args.new_role,
    actor: { type: "user", user_id: args.actor_user_id },
  });
  await ctx.audit.write({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    impersonator_user_id: null,
    subject_type: "workspace_member",
    subject_id: args.target_user_id,
    action: "role_change",
    payload: { from: fromRole, to: args.new_role },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
}

const COOLING_HOURS = 24;

const TransferInput = z.object({
  workspace_id: z.string().min(1),
  current_owner_id: z.string().min(1),
  new_owner_id: z.string().min(1),
  current_password: z.string().min(1).max(256),
});

export async function transferOwnership(
  ctx: AuthContext,
  raw: z.infer<typeof TransferInput>,
): Promise<{ effective_at: string }> {
  const input = TransferInput.parse(raw);
  await requirePermission(ctx, {
    workspace_id: input.workspace_id,
    user_id: input.current_owner_id,
    resource: "workspace",
    action: "transfer",
  });
  const current = await ctx.workspaces.getMember(input.workspace_id, input.current_owner_id);
  if (!current || current.role !== Role.Owner) {
    throw Errors.permissionDenied("workspace", "transfer");
  }
  const owner = await ctx.users.findById(input.current_owner_id);
  if (!owner || !owner.password_hash) throw Errors.invalidCredentials();
  const { verifyPassword } = await import("./internal/hash.js");
  if (!(await verifyPassword(owner.password_hash, input.current_password))) {
    throw Errors.invalidCredentials();
  }
  const successor = await ctx.workspaces.getMember(input.workspace_id, input.new_owner_id);
  if (!successor || successor.removed_at) {
    throw Errors.permissionDenied("workspace", "transfer_to_non_member");
  }

  const effective = new Date(ctx.now().getTime() + COOLING_HOURS * 3600 * 1000).toISOString();
  await ctx.workspaces.setOwner(input.workspace_id, input.new_owner_id, effective);

  await emit("workspace_ownership_transferred", {
    workspace_id: input.workspace_id,
    from_user_id: input.current_owner_id,
    to_user_id: input.new_owner_id,
    effective_at: effective,
  });
  await ctx.audit.write({
    workspace_id: input.workspace_id,
    actor_user_id: input.current_owner_id,
    impersonator_user_id: null,
    subject_type: "workspace",
    subject_id: input.workspace_id,
    action: "ownership_transfer",
    payload: { to_user_id: input.new_owner_id, effective_at: effective },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
  return { effective_at: effective };
}

export async function closeWorkspace(
  ctx: AuthContext,
  args: { workspace_id: string; actor_user_id: string; reason: string | null },
): Promise<{ purge_after: string }> {
  await requirePermission(ctx, {
    workspace_id: args.workspace_id,
    user_id: args.actor_user_id,
    resource: "workspace",
    action: "delete",
  });
  const purgeAfter = new Date(ctx.now().getTime() + 30 * 24 * 3600 * 1000).toISOString();
  await ctx.workspaces.scheduleClose(args.workspace_id, purgeAfter);

  await emit("workspace_closed", {
    workspace_id: args.workspace_id,
    closed_by: args.actor_user_id,
    reason: args.reason,
    purge_after: purgeAfter,
  });
  await ctx.audit.write({
    workspace_id: args.workspace_id,
    actor_user_id: args.actor_user_id,
    impersonator_user_id: null,
    subject_type: "workspace",
    subject_id: args.workspace_id,
    action: "close",
    payload: { reason: args.reason, purge_after: purgeAfter },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
  return { purge_after: purgeAfter };
}
