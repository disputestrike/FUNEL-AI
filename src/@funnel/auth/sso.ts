/**
 * SSO via OpenID Connect (Google + Apple).
 *
 * We use `openid-client`'s discovery + Client classes. A small `Provider`
 * abstraction caches the discovered Issuer so callers don't pay discovery
 * cost on every request.
 *
 * Flow:
 *  1. `beginSso(provider)` → returns `{ url, state, nonce, code_verifier }`.
 *     Caller stores state/nonce/code_verifier in a HttpOnly session-cookie.
 *  2. `completeSso(provider, callbackParams, expected, ip, ua)` →
 *     - validates state/nonce
 *     - exchanges code for tokens
 *     - fetches userinfo (email, sub, name, email_verified)
 *     - finds or creates the user (no password)
 *     - mints a session
 *
 * If the provider does not return `email_verified: true` (Apple sometimes
 * returns false on first login if the user hasn't verified with Apple), we
 * require an additional email verification step before granting full access.
 */

import { Issuer, generators, type Client, type TokenSet } from "openid-client";
import { emit } from "@funnel/events";
import { Errors } from "./errors.js";
import { sha256Hex } from "./internal/hash.js";
import type { AuthContext } from "./internal/ports.js";
import { newId } from "./internal/ids.js";
import { createSession, deriveDeviceFingerprint } from "./session.js";
import type { LoginResult } from "./types.js";

export type SsoProvider = "google" | "apple";

const issuerCache: Partial<Record<SsoProvider, Issuer>> = {};

const ISSUER_URLS: Record<SsoProvider, string> = {
  google: "https://accounts.google.com",
  apple: "https://appleid.apple.com",
};

async function getClient(ctx: AuthContext, provider: SsoProvider): Promise<Client> {
  const cfg = ctx.env.oauth[provider];
  if (!cfg) throw Errors.internal(`SSO provider ${provider} is not configured.`);
  let iss = issuerCache[provider];
  if (!iss) {
    iss = await Issuer.discover(ISSUER_URLS[provider]);
    issuerCache[provider] = iss;
  }
  return new iss.Client({
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    redirect_uris: [cfg.redirect_uri],
    response_types: ["code"],
  });
}

export interface BeginSsoResult {
  url: string;
  state: string;
  nonce: string;
  code_verifier: string;
}

export async function beginSso(ctx: AuthContext, provider: SsoProvider): Promise<BeginSsoResult> {
  const client = await getClient(ctx, provider);
  const state = generators.state();
  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  const url = client.authorizationUrl({
    scope: "openid email profile",
    state,
    nonce,
    code_challenge,
    code_challenge_method: "S256",
    // Apple needs `response_mode=form_post`; openid-client handles via params.
    ...(provider === "apple" ? { response_mode: "form_post" } : {}),
  });
  return { url, state, nonce, code_verifier };
}

export async function completeSso(
  ctx: AuthContext,
  provider: SsoProvider,
  callback: {
    code?: string;
    state?: string;
    /** Apple sometimes also returns `user` JSON with name on the first auth. */
    user?: string;
  },
  expected: { state: string; nonce: string; code_verifier: string },
  ip: string,
  user_agent: string,
): Promise<LoginResult> {
  const client = await getClient(ctx, provider);
  const cfg = ctx.env.oauth[provider]!;
  const tokenSet: TokenSet = await client.callback(
    cfg.redirect_uri,
    { code: callback.code, state: callback.state },
    { state: expected.state, nonce: expected.nonce, code_verifier: expected.code_verifier },
  );

  const claims = tokenSet.claims();
  const sub = claims.sub;
  const email = claims.email as string | undefined;
  const email_verified = claims.email_verified === true;
  const name = (claims.name as string | undefined) ?? null;

  if (!email) throw Errors.invalidToken();

  const emailNormalized = email.toLowerCase().trim();
  let user = await ctx.users.findByEmail(emailNormalized);

  if (!user) {
    const newUser = await ctx.users.create({
      id: newId("usr"),
      email,
      email_normalized: emailNormalized,
      password_hash: null,
      full_name: name,
    });
    user = newUser;
    await ctx.users.update(user.id, {
      email_verified_at: email_verified ? ctx.now().toISOString() : null,
      status: email_verified ? "active" : "pending_verification",
    });
    await emit("user_signed_up", {
      user_id: user.id,
      email_domain: emailNormalized.split("@")[1] ?? "",
      email_hash: sha256Hex(emailNormalized),
      source: provider,
    });
  } else if (email_verified && !user.email_verified_at) {
    await ctx.users.update(user.id, {
      email_verified_at: ctx.now().toISOString(),
      status: "active",
    });
  }

  if (!email_verified) throw Errors.emailNotVerified();

  const { ip_hash, user_agent_class } = deriveDeviceFingerprint(ctx, ip, user_agent);
  const { session, access_token, refresh_token, csrf_token } = await createSession(ctx, {
    user_id: user.id,
    workspace_id: null,
    ip_hash,
    user_agent_class,
    device_id_hash: sha256Hex(sub),
    mfa_satisfied: false,
  });
  await emit("user_logged_in", {
    user_id: user.id,
    session_id: session.id,
    method: provider,
    mfa_used: false,
    new_device: false,
    ip_hash,
  });

  return { status: "authenticated", session, access_token, refresh_token, csrf_token };
}
