/**
 * Workspace API keys.
 *
 * Keys look like:  `fnlk_live_<prefix8>.<secret32>`
 *
 *  - `prefix8` is shown in the dashboard for identification ("fnlk_live_AB12CD34").
 *  - `secret32` is the half we hash with argon2id. Customer sees the secret ONCE
 *    at creation; we never display it again.
 *  - The DB stores `prefix` (lookup) + `secret_hash` (verify).
 *
 * Verify is constant-time-ish thanks to argon2.verify.
 *
 * Rotate = create a fresh key linked to the old one via `rotated_from`,
 * then revoke the old one (typically the caller gives a 7-day overlap to
 * let dependents swap).
 */

import { z } from "zod";
import { emit } from "@funnel/events";
import { Errors } from "./errors.js";
import { hashSecret, verifySecret } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { newId } from "./internal/ids.js";
import { requirePermission } from "./permissions.js";

const PREFIX_LEN = 8;
const SECRET_LEN = 32;
const KEY_NAMESPACE = "fnlk_live_";

function genPrefix(ctx: AuthContext): string {
  // base32-ish: upper alphanumeric, easy to dictate over the phone.
  const raw = Buffer.from(ctx.random(8), "base64url").toString("base64").replace(/[+/=]/g, "");
  return raw.slice(0, PREFIX_LEN).toUpperCase();
}

function genSecret(ctx: AuthContext): string {
  return Buffer.from(ctx.random(24), "base64url").toString("base64url").slice(0, SECRET_LEN);
}

function compose(prefix: string, secret: string): string {
  return `${KEY_NAMESPACE}${prefix}.${secret}`;
}

export function parseApiKey(raw: string): { prefix: string; secret: string } | null {
  if (!raw.startsWith(KEY_NAMESPACE)) return null;
  const body = raw.slice(KEY_NAMESPACE.length);
  const dot = body.indexOf(".");
  if (dot <= 0) return null;
  const prefix = body.slice(0, dot);
  const secret = body.slice(dot + 1);
  if (prefix.length !== PREFIX_LEN || secret.length !== SECRET_LEN) return null;
  return { prefix, secret };
}

const CreateInput = z.object({
  workspace_id: z.string().min(1),
  actor_user_id: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  scopes: z.array(z.string().min(1)).max(64).default([]),
  expires_at: z.string().datetime().optional(),
});

export async function createApiKey(
  ctx: AuthContext,
  raw: z.infer<typeof CreateInput>,
): Promise<{ id: string; key: string; prefix: string }> {
  const input = CreateInput.parse(raw);
  await requirePermission(ctx, {
    workspace_id: input.workspace_id,
    user_id: input.actor_user_id,
    resource: "workspace.api_keys",
    action: "create",
  });

  const prefix = genPrefix(ctx);
  const secret = genSecret(ctx);
  const id = newId("key");
  const secretHash = await hashSecret(secret);
  await ctx.apiKeys.create({
    id,
    workspace_id: input.workspace_id,
    created_by: input.actor_user_id,
    label: input.label,
    prefix,
    secret_hash: secretHash,
    scopes: input.scopes,
    last_used_at: null,
    expires_at: input.expires_at ?? null,
    rotated_from: null,
    revoked_at: null,
    revoked_by: null,
    created_at: ctx.now().toISOString(),
  });

  await emit("api_key_created", {
    workspace_id: input.workspace_id,
    api_key_id: id,
    prefix,
    created_by: input.actor_user_id,
  });
  await ctx.audit.write({
    workspace_id: input.workspace_id,
    actor_user_id: input.actor_user_id,
    impersonator_user_id: null,
    subject_type: "api_key",
    subject_id: id,
    action: "create",
    payload: { prefix, label: input.label, scopes: input.scopes },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });

  return { id, key: compose(prefix, secret), prefix };
}

export async function listApiKeys(
  ctx: AuthContext,
  args: { workspace_id: string; actor_user_id: string },
) {
  await requirePermission(ctx, {
    workspace_id: args.workspace_id,
    user_id: args.actor_user_id,
    resource: "workspace.api_keys",
    action: "read",
  });
  const rows = await ctx.apiKeys.list(args.workspace_id);
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    prefix: r.prefix,
    scopes: r.scopes,
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    revoked_at: r.revoked_at,
    created_at: r.created_at,
  }));
}

export async function rotateApiKey(
  ctx: AuthContext,
  args: { id: string; actor_user_id: string },
): Promise<{ id: string; key: string; prefix: string }> {
  const existing = await ctx.apiKeys.get(args.id);
  if (!existing) throw Errors.apiKeyInvalid();
  await requirePermission(ctx, {
    workspace_id: existing.workspace_id,
    user_id: args.actor_user_id,
    resource: "workspace.api_keys",
    action: "update",
  });
  const prefix = genPrefix(ctx);
  const secret = genSecret(ctx);
  const id = newId("key");
  const secretHash = await hashSecret(secret);
  await ctx.apiKeys.create({
    id,
    workspace_id: existing.workspace_id,
    created_by: args.actor_user_id,
    label: existing.label + " (rotated)",
    prefix,
    secret_hash: secretHash,
    scopes: existing.scopes,
    last_used_at: null,
    expires_at: existing.expires_at,
    rotated_from: existing.id,
    revoked_at: null,
    revoked_by: null,
    created_at: ctx.now().toISOString(),
  });
  await ctx.audit.write({
    workspace_id: existing.workspace_id,
    actor_user_id: args.actor_user_id,
    impersonator_user_id: null,
    subject_type: "api_key",
    subject_id: id,
    action: "rotate",
    payload: { rotated_from: existing.id },
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
  return { id, key: compose(prefix, secret), prefix };
}

export async function revokeApiKey(
  ctx: AuthContext,
  args: { id: string; actor_user_id: string },
): Promise<void> {
  const existing = await ctx.apiKeys.get(args.id);
  if (!existing) throw Errors.apiKeyInvalid();
  await requirePermission(ctx, {
    workspace_id: existing.workspace_id,
    user_id: args.actor_user_id,
    resource: "workspace.api_keys",
    action: "delete",
  });
  await ctx.apiKeys.revoke(args.id, args.actor_user_id, ctx.now().toISOString());
  await emit("api_key_revoked", {
    workspace_id: existing.workspace_id,
    api_key_id: args.id,
    revoked_by: args.actor_user_id,
  });
  await ctx.audit.write({
    workspace_id: existing.workspace_id,
    actor_user_id: args.actor_user_id,
    impersonator_user_id: null,
    subject_type: "api_key",
    subject_id: args.id,
    action: "revoke",
    payload: {},
    justification_ticket_id: null,
    ip_hash: null,
    user_agent_class: null,
  });
}

/**
 * Verify an inbound API key. Returns the matched row or throws.
 */
export async function authenticateApiKey(ctx: AuthContext, raw: string) {
  const parsed = parseApiKey(raw);
  if (!parsed) throw Errors.apiKeyInvalid();
  const row = await ctx.apiKeys.findByPrefix(parsed.prefix);
  if (!row) throw Errors.apiKeyInvalid();
  if (row.revoked_at) throw Errors.apiKeyRevoked();
  if (row.expires_at && new Date(row.expires_at).getTime() < ctx.now().getTime()) {
    throw Errors.apiKeyInvalid();
  }
  if (!(await verifySecret(row.secret_hash, parsed.secret))) {
    throw Errors.apiKeyInvalid();
  }
  await ctx.apiKeys.touchUsed(row.id, ctx.now().toISOString());
  return row;
}
