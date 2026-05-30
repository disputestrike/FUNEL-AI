/**
 * Audit log writer.
 *
 * Per-generation audit entries containing: model used, prompt hash, KB
 * sources, fact-check report, compliance report, content hash, output hash.
 *
 * Retention: 7 years (per 07a §13.2, 07b §7, GDPR Art. 30, 05b §7).
 *
 * Store-of-record: append-only Postgres table `compliance_audit_log`
 * (RLS-tenanted). For tamper-evidence, each row contains a hash-chain
 * pointer to the previous row's `signature_hash` for that workspace.
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import type { ComplianceReport, FactCheckReport } from "./types.js";

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  generationId: string;
  funnelId?: string;
  funnelVersionId?: string;
  /** Model used for the generation. */
  modelLineup: string[];
  promptHash: string;
  /** KB pack IDs sourced for this generation. */
  kbSources: string[];
  contentHash: string;
  outputHash: string;
  factCheck: FactCheckReport;
  compliance: ComplianceReport;
  /** Pointer to previous entry's signature for this workspace, for chaining. */
  previousSignatureHash: string | null;
  /** HMAC over the canonical entry content. */
  signatureHash: string;
  createdAt: string; // ISO-8601
  retentionUntil: string; // 7 years from createdAt
}

export interface AuditWriter {
  write(entry: AuditLogEntry): Promise<void>;
  /** Returns the most recent entry's signatureHash for a workspace, or null. */
  latestSignature(workspaceId: string): Promise<string | null>;
}

export interface AuditOptions {
  hmacSecret: string;
  writer: AuditWriter;
  /** Retention in days. Default 2557 (~7 years). */
  retentionDays?: number;
}

const DEFAULT_RETENTION_DAYS = 2557; // 7 * 365 + leap days

export class AuditLogger {
  constructor(private readonly opts: AuditOptions) {
    if (!opts.hmacSecret || opts.hmacSecret.length < 32) {
      throw new Error("AuditLogger: hmacSecret must be >= 32 chars");
    }
  }

  static sha256(input: string | Buffer): string {
    return createHash("sha256").update(input).digest("hex");
  }

  async record(input: {
    workspaceId: string;
    generationId: string;
    funnelId?: string;
    funnelVersionId?: string;
    modelLineup: string[];
    promptText: string;
    kbSources: string[];
    inputContent: string;
    outputContent: string;
    factCheck: FactCheckReport;
    compliance: ComplianceReport;
  }): Promise<AuditLogEntry> {
    const now = new Date();
    const retention = new Date(now.getTime());
    retention.setUTCDate(retention.getUTCDate() + (this.opts.retentionDays ?? DEFAULT_RETENTION_DAYS));

    const id = `cau_${randomUUID().replace(/-/g, "")}`;
    const previous = await this.opts.writer.latestSignature(input.workspaceId);

    const promptHash = AuditLogger.sha256(input.promptText);
    const contentHash = AuditLogger.sha256(input.inputContent);
    const outputHash = AuditLogger.sha256(input.outputContent);

    const canonical = JSON.stringify({
      id,
      workspaceId: input.workspaceId,
      generationId: input.generationId,
      funnelId: input.funnelId ?? null,
      funnelVersionId: input.funnelVersionId ?? null,
      modelLineup: input.modelLineup,
      promptHash,
      kbSources: input.kbSources,
      contentHash,
      outputHash,
      factCheck: input.factCheck,
      compliance: input.compliance,
      previousSignatureHash: previous,
      createdAt: now.toISOString(),
      retentionUntil: retention.toISOString(),
    });

    const signatureHash = createHmac("sha256", this.opts.hmacSecret).update(canonical).digest("hex");

    const entry: AuditLogEntry = {
      id,
      workspaceId: input.workspaceId,
      generationId: input.generationId,
      funnelId: input.funnelId,
      funnelVersionId: input.funnelVersionId,
      modelLineup: input.modelLineup,
      promptHash,
      kbSources: input.kbSources,
      contentHash,
      outputHash,
      factCheck: input.factCheck,
      compliance: input.compliance,
      previousSignatureHash: previous,
      signatureHash,
      createdAt: now.toISOString(),
      retentionUntil: retention.toISOString(),
    };

    await this.opts.writer.write(entry);
    return entry;
  }

  /** Verify that a given entry's signature matches its content + the given secret. */
  static verify(entry: AuditLogEntry, hmacSecret: string): boolean {
    const canonical = JSON.stringify({
      id: entry.id,
      workspaceId: entry.workspaceId,
      generationId: entry.generationId,
      funnelId: entry.funnelId ?? null,
      funnelVersionId: entry.funnelVersionId ?? null,
      modelLineup: entry.modelLineup,
      promptHash: entry.promptHash,
      kbSources: entry.kbSources,
      contentHash: entry.contentHash,
      outputHash: entry.outputHash,
      factCheck: entry.factCheck,
      compliance: entry.compliance,
      previousSignatureHash: entry.previousSignatureHash,
      createdAt: entry.createdAt,
      retentionUntil: entry.retentionUntil,
    });
    const expected = createHmac("sha256", hmacSecret).update(canonical).digest("hex");
    return expected === entry.signatureHash;
  }
}

/**
 * In-memory writer — used by tests and local dev. Production wires the
 * Prisma-backed writer in @funnel/db.
 */
export class InMemoryAuditWriter implements AuditWriter {
  private readonly entries: AuditLogEntry[] = [];
  private readonly lastByWs = new Map<string, string>();

  async write(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
    this.lastByWs.set(entry.workspaceId, entry.signatureHash);
  }

  async latestSignature(workspaceId: string): Promise<string | null> {
    return this.lastByWs.get(workspaceId) ?? null;
  }

  all(): readonly AuditLogEntry[] {
    return this.entries;
  }
}
