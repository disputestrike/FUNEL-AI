/**
 * DNS setup instructions surfaced to workspace admins.
 *
 * Cloudflare for SaaS requires a CNAME from the user's hostname to our
 * fallback origin (`edge.gofunnelai.com`). For apex domains we instruct ANAME /
 * ALIAS or, if not available, the user's DNS provider's flattening.
 *
 * Returned object is JSON for the editor's "Connect your domain" panel;
 * the same shape is rendered as a fallback HTML page by error-pages/.
 */

export interface DnsInstruction {
  hostname: string;
  type: "CNAME" | "ANAME" | "TXT";
  name: string;
  value: string;
  ttl: number;
  notes?: string;
}

const FALLBACK_ORIGIN = "edge.gofunnelai.com";

export function dnsInstructionsFor(hostname: string, verificationToken?: string): DnsInstruction[] {
  const out: DnsInstruction[] = [];
  const isApex = !hostname.includes(".") || hostname.split(".").length === 2;

  if (isApex) {
    out.push({
      hostname,
      type: "ANAME",
      name: "@",
      value: FALLBACK_ORIGIN,
      ttl: 300,
      notes:
        "If your DNS provider doesn't support ANAME/ALIAS, use Cloudflare's free DNS or a 'CNAME flattening' tier.",
    });
  } else {
    const sub = hostname.split(".")[0]!;
    out.push({
      hostname,
      type: "CNAME",
      name: sub,
      value: FALLBACK_ORIGIN,
      ttl: 300,
    });
  }

  if (verificationToken) {
    out.push({
      hostname,
      type: "TXT",
      name: `_funnel-verify.${hostname}`,
      value: verificationToken,
      ttl: 300,
      notes: "Required once for hostname ownership verification; can be removed after ssl_status=active.",
    });
  }
  return out;
}
