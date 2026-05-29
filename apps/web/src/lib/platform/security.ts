export const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=(self)",
    "usb=()",
    "interest-cohort=()",
  ].join(", "),
  "content-security-policy-report-only": [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.paypal.com https://*.clerk.accounts.dev https://clerk.gofunnelai.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://*.clerk.accounts.dev https://clerk.gofunnelai.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "form-action 'self'",
  ].join("; "),
};

export function applySecurityHeaders(headers: Headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return headers;
}
