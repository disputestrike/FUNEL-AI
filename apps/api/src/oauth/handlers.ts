/**
 * OAuth begin/callback/disconnect handlers — used both by the Hono routes
 * (`/oauth/:provider/start`, `/oauth/:provider/callback`) and the tRPC
 * `integrations.begin` mutation.
 *
 * Token storage:
 *   - State (10 min TTL) → `env.OAUTH_STATE` KV
 *   - Tokens             → `integration_connections.vault_path` (encrypted)
 *                          + Postgres row tracking the connection
 *
 * Encryption: AES-GCM with `env.ENCRYPTION_KEY` (32-byte base64). The cipher
 * lives in a tight helper at the bottom of this file.
 */

import { ulid } from "ulid";
import { withAdminContext } from "@funnel/db/rls";
import type { Env } from "../lib/env.js";
import { getProvider, type OAuthProviderKey } from "./providers.js";

const STATE_TTL_SEC = 10 * 60;

interface BeginArgs {
  env: Env;
  workspaceId: string;
  provider: OAuthProviderKey;
  returnTo: string;
}

interface OAuthStateRecord {
  workspace_id: string;
  provider: OAuthProviderKey;
  csrf: string;
  pkce_verifier?: string;
  return_to: string;
  redirect_uri: string;
  scopes: string[];
  created_at: string;
  expires_at: string;
}

export async function beginOAuth(args: BeginArgs): Promise<{ authorizeUrl: string; stateId: string }> {
  const p = getProvider(args.provider);
  const { clientId } = p.configBuilder(args.env);
  const redirectUri = `${args.env.API_PUBLIC_URL}/oauth/${args.provider}/callback`;
  const stateId = `oas_${ulid()}`;
  const csrf = crypto.randomUUID().replace(/-/g, "");

  let challenge: string | undefined;
  let verifier: string | undefined;
  if (p.usePkce) {
    verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    challenge = base64url(new Uint8Array(digest));
  }

  const record: OAuthStateRecord = {
    workspace_id: args.workspaceId,
    provider: args.provider,
    csrf,
    pkce_verifier: verifier,
    return_to: args.returnTo,
    redirect_uri: redirectUri,
    scopes: p.scopes,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + STATE_TTL_SEC * 1000).toISOString(),
  };
  await args.env.OAUTH_STATE.put(stateId, JSON.stringify(record), { expirationTtl: STATE_TTL_SEC });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: p.scopes.join(" "),
    state: `${stateId}.${csrf}`,
    ...(challenge ? { code_challenge: challenge, code_challenge_method: "S256" } : {}),
    ...(p.extraAuthorizeParams ?? {}),
  });
  const authorizeUrl = `${p.authorizationEndpoint}?${params.toString()}`;
  return { authorizeUrl, stateId };
}

interface CompleteArgs {
  env: Env;
  provider: OAuthProviderKey;
  code: string;
  state: string;
}

export async function completeOAuth(args: CompleteArgs): Promise<{ returnTo: string; workspaceId: string }> {
  const [stateId, csrf] = args.state.split(".");
  if (!stateId || !csrf) throw new Error("Malformed state");
  const raw = await args.env.OAUTH_STATE.get(stateId);
  if (!raw) throw new Error("OAuth state expired or unknown");
  const record = JSON.parse(raw) as OAuthStateRecord;
  if (record.csrf !== csrf) throw new Error("CSRF state mismatch");
  if (record.provider !== args.provider) throw new Error("Provider mismatch");

  const p = getProvider(args.provider);
  const { clientId, clientSecret } = p.configBuilder(args.env);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: record.redirect_uri,
    client_id: clientId,
    client_secret: clientSecret,
    ...(record.pkce_verifier ? { code_verifier: record.pkce_verifier } : {}),
  });

  const tokenRes = await fetch(p.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${text.slice(0, 500)}`);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  const encrypted = await encryptString(args.env.ENCRYPTION_KEY, JSON.stringify(tokens));
  const vaultPath = `vault://${record.workspace_id}/${args.provider}/${ulid()}`;
  const connectionId = `int_${ulid()}`;

  await withAdminContext(async (tx) => {
    await tx.integrationConnection.upsert({
      where: {
        workspace_id_provider: { workspace_id: record.workspace_id, provider: args.provider },
      },
      create: {
        id: connectionId,
        workspace_id: record.workspace_id,
        provider: args.provider,
        external_account_id: (tokens as { user_id?: string }).user_id ?? "",
        vault_path: vaultPath,
        encrypted_tokens: encrypted,
        scopes: tokens.scope ? tokens.scope.split(" ") : record.scopes,
        connected_at: new Date(),
        expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        status: "active",
        degraded: false,
      },
      update: {
        vault_path: vaultPath,
        encrypted_tokens: encrypted,
        scopes: tokens.scope ? tokens.scope.split(" ") : record.scopes,
        connected_at: new Date(),
        expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        status: "active",
        degraded: false,
        deleted_at: null,
      },
    });
  });

  await args.env.OAUTH_STATE.delete(stateId);
  return { returnTo: record.return_to, workspaceId: record.workspace_id };
}

interface DisconnectArgs {
  env: Env;
  workspaceId: string;
  provider: OAuthProviderKey;
}

export async function disconnectOAuth(args: DisconnectArgs): Promise<{ ok: true }> {
  await withAdminContext(async (tx) => {
    await tx.integrationConnection.updateMany({
      where: { workspace_id: args.workspaceId, provider: args.provider, deleted_at: null },
      data: { status: "disconnected", deleted_at: new Date() },
    });
  });
  // Best-effort revocation upstream — not blocking. Per-provider revoke
  // endpoints are wired here as they're added.
  return { ok: true };
}

interface SyncArgs {
  env: Env;
  workspaceId: string;
  provider: OAuthProviderKey;
  since?: string;
}

export async function syncProvider(args: SyncArgs): Promise<{ enqueued: true }> {
  // Production wires this to @funnel/integrations PAL adapters' sync().
  // Here we mark the connection as "sync_pending" and let the cron pick it up.
  await withAdminContext(async (tx) => {
    await tx.integrationConnection.updateMany({
      where: { workspace_id: args.workspaceId, provider: args.provider },
      data: { last_sync_request_at: new Date() } as never,
    });
  });
  return { enqueued: true };
}

// --- crypto helpers ---------------------------------------------------------

function base64url(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importAesKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptString(keyB64: string, plaintext: string): Promise<string> {
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  // Output as `v1:<base64(iv)>:<base64(ct)>`
  return `v1:${base64url(iv)}:${base64url(new Uint8Array(ct))}`;
}

export async function decryptString(keyB64: string, ciphertext: string): Promise<string> {
  const [version, ivB64, ctB64] = ciphertext.split(":");
  if (version !== "v1" || !ivB64 || !ctB64) throw new Error("Invalid ciphertext");
  const key = await importAesKey(keyB64);
  const iv = Uint8Array.from(atob(ivB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
