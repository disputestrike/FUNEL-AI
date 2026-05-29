/**
 * Publish acknowledgment + indemnification (docs/05e).
 *
 * The publish-time checkpoint for regulated verticals. Hard gate: cannot
 * publish without acknowledgment. The flow:
 *
 *   1. UI calls showAcknowledgment(workspace_id, funnel_id, user_id) to load
 *      the policy text + version + impression record.
 *   2. UI tracks scroll-to-end, then enables the checkbox.
 *   3. On checkbox + Confirm, UI calls recordAcknowledgment with the full
 *      audit trail (impression ts, scroll ts, check ts, confirm ts, IP, UA,
 *      content fingerprint).
 *   4. canPublish() returns true iff a valid acknowledgment exists for this
 *      (workspace, funnel, content fingerprint, policy version).
 *
 * Retention: 7 years. HMAC signature per record.
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { isRegulatedVertical, type RegulatedVertical, getRegulatedVertical } from "./regulated-verticals.js";

export const POLICY_VERSION = "publish-ack-v1.0";

/**
 * Canonical acknowledgment text — must match docs/05e Â§5 verbatim. Any change
 * here bumps POLICY_VERSION and re-prompts every affected user.
 */
export const POLICY_CANONICAL_TEXT = `GoFunnelAI Publish Acknowledgment — Regulated Vertical — v1.0

By checking this box and clicking "Confirm & Publish," I acknowledge and agree as follows:

1. AI output is a draft. The content I am about to publish, send, or activate was generated or assisted by GoFunnelAI's AI features. AI output can be inaccurate, biased, outdated, infringing, or non-compliant. It is a draft, not a final, vetted, or legally cleared product.

2. I have reviewed the content. I have personally reviewed every page, message, script, claim, image, audio file, and call flow that will be published, sent, or used. I am not relying on GoFunnelAI to ensure its accuracy, legality, or suitability.

3. I am responsible for compliance. I am solely responsible for ensuring the content complies with all laws, regulations, professional codes, advertising rules, platform policies, and licensing requirements applicable to me, my business, my audience, and every jurisdiction in which the content will be accessible.

4. Professional review. Where my Regulated Vertical requires advice from a licensed professional, I confirm I have either obtained that review or have determined in good faith that the content does not require it for my use case.

5. Licensing and authorization. I confirm I hold (or my client/principal holds) every license, registration, certification, accreditation, or authorization required to operate in the Regulated Vertical and to make the claims being published in every applicable jurisdiction.

6. Substantiation. I have a reasonable basis and contemporaneous documentation for every objective claim, statistic, testimonial, before/after image, outcome, and earnings or savings figure in the content.

7. Consent. I confirm I have all consents legally required to (a) contact each recipient of the content, (b) record calls where applicable, (c) use any individual's name, voice, image, likeness, or biometric identifier, and (d) process any personal data involved.

8. No professional advice from GoFunnelAI. GoFunnelAI does not provide medical, legal, financial, tax, regulatory, or other professional advice, and I am not relying on GoFunnelAI for any such advice.

9. Indemnification. I agree to defend, indemnify, and hold harmless GoFunnelAI, Inc., its affiliates, officers, directors, employees, agents, contractors, and licensors from and against any and all claims, demands, actions, investigations, losses, damages, liabilities, fines, penalties, settlements, judgments, costs, and expenses (including reasonable attorneys' fees and expert fees) arising out of or relating to: (a) my Published Content; (b) my use of the Service in violation of the Terms of Service, the Acceptable Use Policy, or any law; (c) any breach of the representations I make in this acknowledgment; and (d) any third-party claim by a recipient of, or person referenced in, my Published Content. This obligation survives termination of my Account.

10. GoFunnelAI's disclaimer. GoFunnelAI disclaims liability for my Published Content to the maximum extent permitted by law. The Service is provided "as is" and "as available."

11. Audit trail. I understand and agree that this acknowledgment is logged with a timestamp, my IP address, my Account identifier, the version of this text I agreed to, and the publish event it relates to. I agree this electronic record is admissible as evidence of my agreement and that GoFunnelAI may rely on it.

12. Binding nature. I have authority to bind myself, my company, and any client on whose behalf I am publishing. I have read the underlying Terms of Service, Acceptable Use Policy, and Privacy Policy, and I agree to be bound by them.

â˜ I have read and agree to the Publish Acknowledgment (v1.0).`;

export const POLICY_CANONICAL_HASH = createHash("sha256").update(POLICY_CANONICAL_TEXT).digest("hex");

export const ShowAckInputSchema = z.object({
  workspaceId: z.string().min(1),
  funnelId: z.string().min(1),
  userId: z.string().min(1),
  /** Inferred / declared vertical that triggered the prompt. */
  vertical: z.string().min(1),
  /** Locale for the policy text — only English v1.0 is canonical. */
  locale: z.string().default("en-US"),
});
export type ShowAckInput = z.infer<typeof ShowAckInputSchema>;

export interface ShowAckResult {
  acknowledgmentId: string;
  policyVersion: string;
  policyHash: string;
  policyText: string;
  /** The matching RegulatedVertical record, if any. */
  vertical: RegulatedVertical | null;
  /** Already acknowledged? If true, no checkbox needed. */
  alreadyAcknowledgedForCurrentContent: boolean;
  /** Already acknowledged but content fingerprint differs — re-prompt with diff highlight. */
  contentChangedSinceLastAck: boolean;
  /** Server-recorded impression time used by the audit trail. */
  displayedAt: string;
}

export const RecordAckInputSchema = z.object({
  acknowledgmentId: z.string().min(1),
  workspaceId: z.string().min(1),
  funnelId: z.string().min(1),
  funnelVersionId: z.string().min(1),
  userId: z.string().min(1),
  userEmail: z.string().email(),
  vertical: z.string().min(1),
  policyVersion: z.string().min(1),
  policyHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyLocale: z.string().min(2),
  /** Hash of the funnel content being published. */
  contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  /** Source IP. Stored as hash. */
  sourceIp: z.string().nullable(),
  userAgent: z.string().min(1),
  geoCountry: z.string().length(2).optional(),
  triggerReasons: z.array(z.string()).min(1),
  displayedAt: z.string().datetime(),
  scrolledToEndAt: z.string().datetime(),
  checkboxCheckedAt: z.string().datetime(),
  confirmedAt: z.string().datetime(),
  publishEventId: z.string().min(1).optional(),
});
export type RecordAckInput = z.infer<typeof RecordAckInputSchema>;

export interface AcknowledgmentRecord {
  id: string;
  workspaceId: string;
  funnelId: string;
  funnelVersionId: string;
  userId: string;
  userEmail: string;
  vertical: string;
  policyVersion: string;
  policyHash: string;
  policyLocale: string;
  contentFingerprint: string;
  sourceIpHash: string | null;
  userAgent: string;
  geoCountry: string | null;
  triggerReasons: string[];
  displayedAt: string;
  scrolledToEndAt: string;
  checkboxCheckedAt: string;
  confirmedAt: string;
  publishEventId: string | null;
  signature: string;
  retentionUntil: string;
}

export interface AcknowledgmentStore {
  putImpression(id: string, displayedAt: string): Promise<void>;
  put(record: AcknowledgmentRecord): Promise<void>;
  /** Find a record matching workspace+funnel+contentFingerprint+policyVersion. */
  findValid(input: {
    workspaceId: string;
    funnelId: string;
    contentFingerprint: string;
    policyVersion: string;
  }): Promise<AcknowledgmentRecord | null>;
  /** Find the latest record for a (workspace, funnel) regardless of content. */
  findLatestForFunnel(workspaceId: string, funnelId: string): Promise<AcknowledgmentRecord | null>;
  /** Used by the user export view. */
  listByUser(userId: string, workspaceId: string): Promise<AcknowledgmentRecord[]>;
}

export interface PublishAckOptions {
  store: AcknowledgmentStore;
  hmacSecret: string;
  ipHashSalt: string;
  /** Retention period in days. Default 2557 (~7 years). */
  retentionDays?: number;
  /** Time-skew tolerance for ordering checks. Default 5000 ms. */
  clockSkewMs?: number;
}

export class PublishAcknowledgmentService {
  constructor(private readonly opts: PublishAckOptions) {
    if (!opts.hmacSecret || opts.hmacSecret.length < 32) {
      throw new Error("PublishAcknowledgmentService: hmacSecret must be >= 32 chars");
    }
  }

  /**
   * Returns the policy text + per-impression id. Idempotent — calling again
   * returns a fresh impression id but the same policy text/version.
   */
  async showAcknowledgment(input: ShowAckInput, currentContentFingerprint: string | null): Promise<ShowAckResult> {
    const parsed = ShowAckInputSchema.parse(input);
    const vertical = getRegulatedVertical(parsed.vertical) ?? null;

    const id = `pak_${randomUUID().replace(/-/g, "")}`;
    const displayedAt = new Date().toISOString();
    await this.opts.store.putImpression(id, displayedAt);

    let alreadyAcked = false;
    let changed = false;
    if (currentContentFingerprint) {
      const valid = await this.opts.store.findValid({
        workspaceId: parsed.workspaceId,
        funnelId: parsed.funnelId,
        contentFingerprint: currentContentFingerprint,
        policyVersion: POLICY_VERSION,
      });
      alreadyAcked = !!valid;
      if (!alreadyAcked) {
        const latest = await this.opts.store.findLatestForFunnel(parsed.workspaceId, parsed.funnelId);
        changed =
          !!latest &&
          latest.policyVersion === POLICY_VERSION &&
          latest.contentFingerprint !== currentContentFingerprint;
      }
    }

    return {
      acknowledgmentId: id,
      policyVersion: POLICY_VERSION,
      policyHash: POLICY_CANONICAL_HASH,
      policyText: POLICY_CANONICAL_TEXT,
      vertical,
      alreadyAcknowledgedForCurrentContent: alreadyAcked,
      contentChangedSinceLastAck: changed,
      displayedAt,
    };
  }

  /**
   * Record an acknowledgment. Validates the UX flow ordering (impression â†’
   * scroll-to-end â†’ checkbox â†’ confirm) before persisting.
   */
  async recordAcknowledgment(input: RecordAckInput): Promise<AcknowledgmentRecord> {
    const parsed = RecordAckInputSchema.parse(input);

    if (parsed.policyVersion !== POLICY_VERSION) {
      throw new Error(`Stale policy version ${parsed.policyVersion}; current is ${POLICY_VERSION}.`);
    }
    if (parsed.policyHash !== POLICY_CANONICAL_HASH) {
      throw new Error("Policy hash mismatch — UI may be displaying stale or tampered text.");
    }

    const displayed = Date.parse(parsed.displayedAt);
    const scrolled = Date.parse(parsed.scrolledToEndAt);
    const checked = Date.parse(parsed.checkboxCheckedAt);
    const confirmed = Date.parse(parsed.confirmedAt);
    const skew = this.opts.clockSkewMs ?? 5_000;

    if (!(displayed <= scrolled + skew && scrolled <= checked + skew && checked <= confirmed + skew)) {
      throw new Error("Acknowledgment ordering invariant violated (displayed â†’ scroll â†’ check â†’ confirm).");
    }

    const retention = new Date();
    retention.setUTCDate(retention.getUTCDate() + (this.opts.retentionDays ?? 2557));

    const sourceIpHash = parsed.sourceIp
      ? createHash("sha256").update(this.opts.ipHashSalt + parsed.sourceIp).digest("hex")
      : null;

    const baseRecord: AcknowledgmentRecord = {
      id: parsed.acknowledgmentId,
      workspaceId: parsed.workspaceId,
      funnelId: parsed.funnelId,
      funnelVersionId: parsed.funnelVersionId,
      userId: parsed.userId,
      userEmail: parsed.userEmail,
      vertical: parsed.vertical,
      policyVersion: parsed.policyVersion,
      policyHash: parsed.policyHash,
      policyLocale: parsed.policyLocale,
      contentFingerprint: parsed.contentFingerprint,
      sourceIpHash,
      userAgent: parsed.userAgent,
      geoCountry: parsed.geoCountry ?? null,
      triggerReasons: parsed.triggerReasons,
      displayedAt: parsed.displayedAt,
      scrolledToEndAt: parsed.scrolledToEndAt,
      checkboxCheckedAt: parsed.checkboxCheckedAt,
      confirmedAt: parsed.confirmedAt,
      publishEventId: parsed.publishEventId ?? null,
      signature: "", // computed below
      retentionUntil: retention.toISOString(),
    };
    const canonical = JSON.stringify({ ...baseRecord, signature: undefined });
    const signature = createHmac("sha256", this.opts.hmacSecret).update(canonical).digest("hex");
    const finalRec: AcknowledgmentRecord = { ...baseRecord, signature };

    await this.opts.store.put(finalRec);
    return finalRec;
  }

  /**
   * Hard gate: can this (workspace, funnel) publish?
   * Returns {ok: true} if vertical is not regulated OR a valid ack exists.
   * Otherwise returns {ok: false, reason}.
   */
  async canPublish(input: {
    workspaceId: string;
    funnelId: string;
    vertical: string | null;
    contentFingerprint: string;
  }): Promise<{ ok: true } | { ok: false; reason: string; needsAck: boolean }> {
    if (!input.vertical || !isRegulatedVertical(input.vertical)) {
      return { ok: true };
    }
    const valid = await this.opts.store.findValid({
      workspaceId: input.workspaceId,
      funnelId: input.funnelId,
      contentFingerprint: input.contentFingerprint,
      policyVersion: POLICY_VERSION,
    });
    if (valid) return { ok: true };
    return {
      ok: false,
      reason: "Regulated vertical requires publish-time acknowledgment for this content version.",
      needsAck: true,
    };
  }

  /** User export: list all of a user's acknowledgments in a workspace. */
  async listForUser(userId: string, workspaceId: string): Promise<AcknowledgmentRecord[]> {
    return this.opts.store.listByUser(userId, workspaceId);
  }

  /** Helper: SHA-256 of a content blob — call before showAcknowledgment / canPublish. */
  static fingerprint(content: string | Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }
}

/** Reference in-memory store. */
export class InMemoryAckStore implements AcknowledgmentStore {
  private readonly records: AcknowledgmentRecord[] = [];
  private readonly impressions = new Map<string, string>();

  async putImpression(id: string, displayedAt: string): Promise<void> {
    this.impressions.set(id, displayedAt);
  }
  async put(record: AcknowledgmentRecord): Promise<void> {
    this.records.push(record);
  }
  async findValid(input: {
    workspaceId: string;
    funnelId: string;
    contentFingerprint: string;
    policyVersion: string;
  }): Promise<AcknowledgmentRecord | null> {
    return (
      this.records.find(
        (r) =>
          r.workspaceId === input.workspaceId &&
          r.funnelId === input.funnelId &&
          r.contentFingerprint === input.contentFingerprint &&
          r.policyVersion === input.policyVersion,
      ) ?? null
    );
  }
  async findLatestForFunnel(workspaceId: string, funnelId: string): Promise<AcknowledgmentRecord | null> {
    const sorted = this.records
      .filter((r) => r.workspaceId === workspaceId && r.funnelId === funnelId)
      .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
    return sorted[0] ?? null;
  }
  async listByUser(userId: string, workspaceId: string): Promise<AcknowledgmentRecord[]> {
    return this.records.filter((r) => r.userId === userId && r.workspaceId === workspaceId);
  }
}
