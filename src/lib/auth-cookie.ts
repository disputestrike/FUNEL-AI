/**
 * Single source of truth for the mock auth cookie name and helpers.
 *
 * When real auth lands, only this file changes — every consumer
 * (middleware, Header, /api/auth/logout) reads from here.
 */
export const AUTH_COOKIE = "mock-auth-session";

/**
 * Set the stubbed session cookie from client code.
 * Lasts 7 days. SameSite=Lax so it survives marketing-domain redirects.
 */
export function setMockSession(email: string) {
  if (typeof document === "undefined") return;
  const sevenDays = 60 * 60 * 24 * 7;
  const payload = encodeURIComponent(
    JSON.stringify({ email, ts: Date.now() }),
  );
  document.cookie = `${AUTH_COOKIE}=${payload}; Max-Age=${sevenDays}; Path=/; SameSite=Lax`;
}
