/**
 * Domain reputation scan (monthly cron).
 *
 * For every published funnel domain we scan against:
 *   - Google Safe Browsing
 *   - Microsoft SmartScreen
 *   - Abuse blacklists (@funnel/trust-safety maintains the list)
 *
 * Any flagged domain emits a governance event + opens an incident in the
 * trust-safety console. The renderer reads the domain status table and pauses
 * traffic if the domain is on a blocked list.
 */

import { z } from "zod";

import { buildWorker } from "../worker-base.js";
import { emitInternal } from "../events-bridge.js";
import { log } from "../monitoring.js";

const DomainScanJobSchema = z.object({
  /** When set, scan only this domain. */
  domain: z.string().optional(),
});

interface TrustSafetyModule {
  scanAllDomains(opts?: { domain?: string }): Promise<{
    scanned: number;
    findings: Array<{
      domain: string;
      list: string;
      severity: "info" | "low" | "medium" | "high";
      reason: string;
    }>;
  }>;
  markDomainFlagged(args: { domain: string; reason: string; severity: string }): Promise<void>;
}

export const domainReputationWorker = buildWorker(
  { queue: "domain-reputation" },
  {
    name: "domain-reputation.scan",
    schema: DomainScanJobSchema,
    idempotencyKey: (d) =>
      `domain-rep:${new Date().toISOString().slice(0, 7)}:${d.domain ?? "all"}`,
    async run({ data }) {
      const mod = (await import("@funnel/compliance")) as unknown as TrustSafetyModule;
      emitInternal("domain_reputation_scan_started", { scope: data.domain ?? "all" });

      const result = await mod.scanAllDomains(data.domain ? { domain: data.domain } : undefined);

      for (const finding of result.findings) {
        if (finding.severity === "high" || finding.severity === "medium") {
          await mod
            .markDomainFlagged({
              domain: finding.domain,
              reason: finding.reason,
              severity: finding.severity,
            })
            .catch((err) =>
              log("error", { msg: "markDomainFlagged failed", error: (err as Error).message }),
            );
          emitInternal("governance_event", {
            kind: "domain_reputation_flag",
            domain: finding.domain,
            list: finding.list,
            severity: finding.severity,
            reason: finding.reason,
          });
        }
      }

      emitInternal("domain_reputation_scan_completed", {
        scanned: result.scanned,
        flagged: result.findings.length,
      });
      return { scanned: result.scanned, flagged: result.findings.length };
    },
  },
);
