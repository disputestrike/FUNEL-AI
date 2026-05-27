/**
 * Cloudflare Turnstile (captcha) verification.
 *
 * Returns true if no secret is configured (dev mode) so local dev doesn't
 * require a real captcha. In production TURNSTILE_SECRET must be set.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(opts: {
  token: string | null | undefined;
  remoteIp: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    // Dev mode: allow.
    return { ok: true };
  }
  if (!opts.token) {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", opts.token);
  if (opts.remoteIp) body.append("remoteip", opts.remoteIp);

  try {
    const resp = await fetch(VERIFY_URL, {
      method: "POST",
      body,
    });
    if (!resp.ok) return { ok: false, reason: `http_${resp.status}` };
    const json = (await resp.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success) return { ok: true };
    return { ok: false, reason: (json["error-codes"] ?? ["unknown"]).join(",") };
  } catch (err) {
    return { ok: false, reason: `network:${String(err)}` };
  }
}
