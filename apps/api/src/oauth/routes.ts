/**
 * HTTP routes for OAuth flow:
 *   GET /oauth/:provider/start     → 302 to authorize URL
 *   GET /oauth/:provider/callback  → exchanges code, persists token, 302 to return_to
 *
 * Callback is server-to-server-ish — the user's browser is the carrier but
 * we never expose tokens to the browser. CORS is intentionally NOT applied to
 * this route group; OAuth providers redirect with no Origin header.
 */

import { Hono } from "hono";
import { OAUTH_PROVIDERS, type OAuthProviderKey } from "./providers.js";
import { beginOAuth, completeOAuth } from "./handlers.js";
import type { HonoEnv } from "../lib/context.js";

export function buildOAuthRouter(): Hono<HonoEnv> {
  const r = new Hono<HonoEnv>();
  const providerKeys = OAUTH_PROVIDERS.map((p) => p.providerKey);

  // --- start ---------------------------------------------------------
  r.get("/:provider/start", async (c) => {
    const provider = c.req.param("provider") as OAuthProviderKey;
    if (!providerKeys.includes(provider)) return c.json({ error: "unknown_provider" }, 404);

    const ctx = c.get("ctx");
    if (!ctx?.workspaceId) return c.json({ error: "workspace_required" }, 401);

    const returnTo = c.req.query("return_to") ?? `${c.env.WEB_PUBLIC_URL}/dashboard/integrations`;
    const { authorizeUrl } = await beginOAuth({
      env: c.env,
      workspaceId: ctx.workspaceId,
      provider,
      returnTo,
    });
    return c.redirect(authorizeUrl, 302);
  });

  // --- callback ------------------------------------------------------
  r.get("/:provider/callback", async (c) => {
    const provider = c.req.param("provider") as OAuthProviderKey;
    if (!providerKeys.includes(provider)) return c.json({ error: "unknown_provider" }, 404);

    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    if (error) {
      const fallback = `${c.env.WEB_PUBLIC_URL}/dashboard/integrations?error=${encodeURIComponent(error)}`;
      return c.redirect(fallback, 302);
    }
    if (!code || !state) return c.json({ error: "missing_params" }, 400);

    try {
      const { returnTo } = await completeOAuth({ env: c.env, provider, code, state });
      const sep = returnTo.includes("?") ? "&" : "?";
      return c.redirect(`${returnTo}${sep}connected=${provider}`, 302);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      const fallback = `${c.env.WEB_PUBLIC_URL}/dashboard/integrations?error=${encodeURIComponent(msg)}`;
      return c.redirect(fallback, 302);
    }
  });

  return r;
}
