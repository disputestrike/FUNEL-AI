/**
 * OAuth flow for GoFunnelAI.
 *
 * Uses chrome.identity.launchWebAuthFlow to redirect through login.gofunnelai.com
 * with PKCE. Tokens are stored in @plasmohq/storage (chrome.storage.local
 * under the hood) so they survive service-worker restarts.
 *
 * Token shape matches what @funnel/sdk expects in its `Authorization: Bearer ...`
 * header â€” that SDK is the single source of truth for API calls; we only
 * persist tokens here and hand them off.
 */

import { Storage } from "@plasmohq/storage"

const FUNNEL_AUTH_HOST = "https://login.gofunnelai.com"
const FUNNEL_CLIENT_ID = process.env.PLASMO_PUBLIC_FUNNEL_CLIENT_ID ?? "ext_browser"
const STORAGE_KEY_TOKEN = "funnel.auth.token"
const STORAGE_KEY_REFRESH = "funnel.auth.refresh"
const STORAGE_KEY_USER = "funnel.auth.user"

export interface FunnelToken {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
}

export interface FunnelUser {
  id: string
  email: string
  name: string
  workspaceId: string
  workspaceName: string
}

const storage = new Storage({ area: "local" })

/**
 * Generate a PKCE code verifier + challenge pair.
 * RFC 7636 â€” 43â€“128 chars, base64url-encoded SHA-256.
 */
async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  const verifier = base64url(bytes)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  const challenge = base64url(new Uint8Array(digest))
  return { verifier, challenge }
}

function base64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Kick off the OAuth dance. Resolves with the persisted user record once
 * the redirect comes back with an authorization code we successfully exchange.
 */
export async function login(): Promise<FunnelUser> {
  const { verifier, challenge } = await pkcePair()
  const redirectUri = chrome.identity.getRedirectURL("funnel-oauth")
  const state = crypto.randomUUID()

  const authUrl = new URL(`${FUNNEL_AUTH_HOST}/oauth/authorize`)
  authUrl.searchParams.set("client_id", FUNNEL_CLIENT_ID)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "openid profile funnels:read funnels:write leads:read leads:write")
  authUrl.searchParams.set("code_challenge", challenge)
  authUrl.searchParams.set("code_challenge_method", "S256")
  authUrl.searchParams.set("state", state)

  const redirectBack = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  })

  if (!redirectBack) throw new Error("OAuth flow cancelled")
  const u = new URL(redirectBack)
  const code = u.searchParams.get("code")
  const returnedState = u.searchParams.get("state")
  if (!code) throw new Error("No authorization code returned")
  if (returnedState !== state) throw new Error("OAuth state mismatch â€” possible CSRF")

  // Exchange code â†’ token at the auth server. The auth server, not the
  // browser, holds the client secret â€” we authenticate only via PKCE.
  const tokenRes = await fetch(`${FUNNEL_AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: FUNNEL_CLIENT_ID,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
  const payload = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    user: FunnelUser
  }

  const token: FunnelToken = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  }
  await storage.set(STORAGE_KEY_TOKEN, token)
  await storage.set(STORAGE_KEY_REFRESH, payload.refresh_token)
  await storage.set(STORAGE_KEY_USER, payload.user)
  return payload.user
}

export async function logout(): Promise<void> {
  await Promise.all([
    storage.remove(STORAGE_KEY_TOKEN),
    storage.remove(STORAGE_KEY_REFRESH),
    storage.remove(STORAGE_KEY_USER),
  ])
}

export async function getCurrentUser(): Promise<FunnelUser | null> {
  return ((await storage.get(STORAGE_KEY_USER)) as FunnelUser | undefined) ?? null
}

/**
 * Returns a valid access token, refreshing in the background if it's within
 * 60 seconds of expiry. Throws if the user isn't logged in.
 */
export async function getAccessToken(): Promise<string> {
  const token = (await storage.get(STORAGE_KEY_TOKEN)) as FunnelToken | undefined
  if (!token) throw new Error("Not authenticated")
  if (token.expiresAt - Date.now() > 60_000) return token.accessToken
  return refresh(token.refreshToken)
}

async function refresh(refreshToken: string): Promise<string> {
  const res = await fetch(`${FUNNEL_AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: FUNNEL_CLIENT_ID,
    }),
  })
  if (!res.ok) {
    await logout()
    throw new Error("Refresh failed â€” please log in again")
  }
  const payload = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  const next: FunnelToken = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  }
  await storage.set(STORAGE_KEY_TOKEN, next)
  await storage.set(STORAGE_KEY_REFRESH, payload.refresh_token)
  return next.accessToken
}
