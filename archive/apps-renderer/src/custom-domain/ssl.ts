/**
 * Cloudflare for SaaS — custom hostname SSL status check.
 *
 * The renderer doesn't directly issue certs (apps/api does that via the
 * Cloudflare API on `POST /custom-domains`). This helper queries the public
 * SaaS status so the editor / "domain setup" UI can render verification state.
 *
 * Surface: GET /__cf-saas/status?hostname=... — proxied through the editor.
 * In the renderer itself we use it for the friendlier "your DNS isn't set up
 * yet" error page when the route exists in DB but the cert is pending.
 */

export interface HostnameStatus {
  hostname: string;
  status: "pending" | "active" | "expired" | "failed" | "deleted";
  verification: {
    method: "txt" | "http";
    record_name?: string;
    record_value?: string;
  } | null;
  ssl_status: "pending_validation" | "active" | "failed" | "unknown";
}

/**
 * Hit the Cloudflare API for the named custom hostname. The renderer worker
 * has no Cloudflare API token (it's read-only for routing); this returns a
 * `unknown`-status placeholder if the binding isn't configured. In production
 * apps/api proxies the real call.
 */
export async function getHostnameStatus(
  apiBaseUrl: string,
  hostname: string,
  internalSecret: string
): Promise<HostnameStatus | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl.replace(/\/+$/, "")}/internal/custom-domains/status?hostname=${encodeURIComponent(hostname)}`,
      {
        headers: {
          authorization: `Bearer ${internalSecret}`,
          accept: "application/json",
        },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as HostnameStatus;
  } catch {
    return null;
  }
}
