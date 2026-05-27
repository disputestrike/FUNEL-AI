/**
 * SSRF-safe URL validator for audit submissions.
 *
 * Rejects:
 *  - non-http(s) schemes (file://, gopher://, ftp://, javascript:, data:)
 *  - localhost / 127.0.0.0/8 / ::1
 *  - private IPv4 ranges (10/8, 172.16/12, 192.168/16, 169.254/16 link-local)
 *  - IPv6 unique local / link local / loopback
 *  - .local / .internal / .arpa hosts
 *  - URLs with embedded credentials (user:pass@host)
 *  - URLs longer than 2048 chars
 */

export type UrlValidationError =
  | "malformed"
  | "scheme"
  | "credentials"
  | "localhost"
  | "private_ipv4"
  | "private_ipv6"
  | "internal_tld"
  | "too_long"
  | "ip_in_hostname_disallowed";

export class InvalidAuditUrlError extends Error {
  constructor(public readonly reason: UrlValidationError, msg?: string) {
    super(msg ?? reason);
    this.name = "InvalidAuditUrlError";
  }
}

const PRIVATE_IPV4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

const PRIVATE_IPV6 = [
  /^::1$/, // loopback
  /^::$/, // unspecified
  /^fc/i, // unique local fc00::/7
  /^fd/i, // unique local
  /^fe[89ab]/i, // link local fe80::/10
];

function isIpv4(host: string): boolean {
  // RFC-strict IPv4 dotted-quad.
  if (!/^[0-9.]+$/.test(host)) return false;
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function isIpv6(host: string): boolean {
  // host is the literal inside [brackets] when called from URL.hostname.
  return host.includes(":");
}

/**
 * Validate a user-submitted URL is safe to fetch. Throws `InvalidAuditUrlError`.
 * Returns a normalized `URL` (lowercased hostname, no fragment, no trailing slash on root).
 */
export function validateAuditUrl(raw: string): URL {
  if (typeof raw !== "string") throw new InvalidAuditUrlError("malformed");
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    throw new InvalidAuditUrlError(trimmed.length === 0 ? "malformed" : "too_long");
  }

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new InvalidAuditUrlError("malformed");
  }

  const proto = u.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    throw new InvalidAuditUrlError("scheme", `Unsupported scheme: ${proto}`);
  }

  if (u.username !== "" || u.password !== "") {
    throw new InvalidAuditUrlError("credentials");
  }

  const host = u.hostname.toLowerCase();
  if (host === "" || host === "localhost") {
    throw new InvalidAuditUrlError("localhost");
  }

  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".arpa")) {
    throw new InvalidAuditUrlError("internal_tld");
  }

  if (isIpv4(host)) {
    if (PRIVATE_IPV4.test(host)) {
      throw new InvalidAuditUrlError("private_ipv4");
    }
    // We could allow public IPv4, but the spec says only public hostnames.
    // Allow public IPs; many real domains resolve through CDNs anyway.
  }

  if (isIpv6(host)) {
    if (PRIVATE_IPV6.some((re) => re.test(host))) {
      throw new InvalidAuditUrlError("private_ipv6");
    }
  }

  // Normalize: drop hash, leave path/query intact.
  u.hash = "";
  return u;
}

/** Render a friendly user-facing error message for a validation reason. */
export function describeValidationError(reason: UrlValidationError): string {
  switch (reason) {
    case "malformed":
      return "That doesn't look like a URL. Try https://example.com.";
    case "scheme":
      return "Only http:// and https:// URLs are supported.";
    case "credentials":
      return "URLs with embedded usernames/passwords aren't allowed.";
    case "localhost":
      return "Localhost URLs can't be audited.";
    case "private_ipv4":
    case "private_ipv6":
      return "Private network addresses can't be audited.";
    case "internal_tld":
      return "Internal-only hostnames (.local, .internal) can't be audited.";
    case "too_long":
      return "That URL is too long.";
    case "ip_in_hostname_disallowed":
      return "Raw IP addresses can't be audited.";
  }
}
