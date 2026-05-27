/**
 * Audit sink — persists ONLY admin / governance / trust-safety events to the
 * immutable `audit_log` table. We don't audit every event — that's the
 * analytics warehouse's job.
 */

import { bucketOf } from "../taxonomy.js";
import type { Envelope } from "../envelope.js";
import type { Sink } from "../emitter.js";

const AUDIT_BUCKETS = new Set(["support", "governance", "identity"]);

export interface AuditWriter {
  write(envelope: Envelope): Promise<void>;
}

export function auditSink(writer: AuditWriter): Sink {
  return {
    name: "audit",
    async receive(envelope) {
      const bucket = bucketOf(envelope.event_name);
      if (!bucket || !AUDIT_BUCKETS.has(bucket)) return;
      await writer.write(envelope);
    },
  };
}

export class InMemoryAuditWriter implements AuditWriter {
  public readonly rows: Envelope[] = [];
  async write(envelope: Envelope): Promise<void> {
    this.rows.push(envelope);
  }
}
