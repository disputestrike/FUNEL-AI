/**
 * Audit logging adapter for the billing package.
 *
 * Every state change in billing writes to `audit_log`. We expose a thin sink
 * here so the package can be tested without a real DB; production wires
 * `setAuditSink(prismaSink)` at boot.
 *
 * Doc 12 §Appendix C #4: every write that affects another user emits an event
 * AND writes an audit_log row in the same transaction.
 */

import type { AuditLogEntry } from "./types.js";

export type AuditSink = (entry: AuditLogEntry) => void | Promise<void>;

const defaultSink: AuditSink = (entry) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ kind: "audit_log", ...entry }));
};

let currentSink: AuditSink = defaultSink;

export function setAuditSink(sink: AuditSink): void {
  currentSink = sink;
}

export async function writeAuditLog(entry: Omit<AuditLogEntry, "occurred_at"> & { occurred_at?: string }): Promise<void> {
  await currentSink({
    occurred_at: entry.occurred_at ?? new Date().toISOString(),
    ...entry,
  });
}
