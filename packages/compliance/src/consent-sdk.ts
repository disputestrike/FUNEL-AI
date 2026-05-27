/**
 * Consent SDK.
 *
 * Records and retrieves consent artifacts for forms, voice calls, SMS,
 * marketing email, AI training, and DSR honoring. Retention: 7 years for
 * marketing-style consent records, 10 years for voice/SMS/CAN-SPAM-related
 * (per 07a §7.1 and 03 governance family).
 *
 * Honors delete-my-data within 24 hours: `requestDeletion` enqueues a
 * cascade that wipes the linked contact PII but retains a tombstone for
 * legal defense (per 05b Privacy Policy §7).
 */

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const ConsentTypeSchema = z.enum([
  "marketing_email",
  "marketing_sms",
  "marketing_voice",
  "form_submission",
  "ai_training",
  "cookies_analytics",
  "cookies_marketing",
  "call_recording",
  "data_processing", // GDPR Art 6 lawful basis = consent
]);
export type ConsentType = z.infer<typeof ConsentTypeSchema>;

export const ConsentScopeSchema = z.enum([
  "workspace_only",
  "specific_funnel",
  "specific_campaign",
  "platform_wide_marketing",
]);
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

export const ConsentSourceSchema = z.enum([
  "web_form_single_optin",
  "web_form_double_optin",
  "imported_attested",
  "spoken_on_call",
  "checkbox_explicit",
  "api_integration",
  "in_app_settings",
]);
export type ConsentSource = z.infer<typeof ConsentSourceSchema>;

export const CaptureConsentInputSchema = z.object({
  workspaceId: z.string().min(1),
  type: ConsentTypeSchema,
  /** E.164 phone, normalized email, or other identifier. */
  identifier: z.string().min(1),
  /** Sub-type of identifier for indexing. */
  identifierKind: z.enum(["email", "phone_e164", "user_id", "device_id", "session_id"]),
  scope: ConsentScopeSchema,
  source: ConsentSourceSchema,
  /** Source IP at moment of consent. Will be stored as hash; raw discarded. */
  sourceIp: z.string().nullable(),
  /** User-agent string at moment of consent. */
  userAgent: z.string().nullable(),
  /** Was the consent checkbox actually checked? Must be true to record affirmative. */
  checkboxState: z.boolean(),
  /** Exact disclosure / consent text shown to the user, verbatim. */
  consentTextVersion: z.string().min(1),
  /** SHA-256 of the canonical disclosure text. */
  consentTextHash: z.string().regex(/^[a-f0-9]{64}$/),
  /** Optional proof artifact (URL to screenshot, etc). */
  proofArtifactUrl: z.string().url().optional(),
  /** Optional purpose strings, eg ['lead_followup','reminders']. */
  purposes: z.array(z.string()).default([]),
  /** Optional contact id linkage. */
  contactId: z.string().optional(),
});
export type CaptureConsentInput = z.infer<typeof CaptureConsentInputSchema>;

export interface ConsentRecord {
  id: string;
  workspaceId: string;
  type: ConsentType;
  identifier: string;
  identifierKind: CaptureConsentInput["identifierKind"];
  identifierHash: string;
  scope: ConsentScope;
  source: ConsentSource;
  sourceIpHash: string | null;
  userAgent: string | null;
  consentTextVersion: string;
  consentTextHash: string;
  proofArtifactUrl: string | null;
  purposes: string[];
  contactId: string | null;
  givenAt: string; // ISO-8601
  withdrawnAt: string | null;
  withdrawnMethod: ConsentWithdrawalMethod | null;
  retentionUntil: string; // ISO-8601
}

export type ConsentWithdrawalMethod =
  | "sms_stop_keyword"
  | "email_unsubscribe_link"
  | "voice_opt_out_keyword"
  | "settings_panel"
  | "dsr_request"
  | "support_ticket";

export interface ConsentStore {
  put(record: ConsentRecord): Promise<void>;
  /** Returns the most recent active record (withdrawnAt is null) for the (workspace, type, identifierHash). */
  latestActive(workspaceId: string, type: ConsentType, identifierHash: string): Promise<ConsentRecord | null>;
  /** Returns all records for an identifier across types (for export / deletion). */
  listByIdentifier(workspaceId: string, identifierHash: string): Promise<ConsentRecord[]>;
  /** Update withdrawal fields. */
  withdraw(id: string, withdrawnAt: string, method: ConsentWithdrawalMethod): Promise<void>;
  /** Hard-delete a record (used by deletion cascade). */
  hardDelete(id: string): Promise<void>;
}

export interface ConsentSdkOptions {
  store: ConsentStore;
  /** Hash salt — separate from production secrets so leakage of one consent record cannot rainbow-table to other deployments. */
  identifierHashSalt: string;
  /** Retention defaults. */
  defaultRetentionDays?: number;
  smsVoiceRetentionDays?: number;
  /** Deletion cascade hook — called when an identifier requests data deletion. */
  cascadeHook?: (workspaceId: string, identifierHash: string) => Promise<void>;
}

const DEFAULT_RETENTION_DAYS = 2557; // 7 years
const SMS_VOICE_RETENTION_DAYS = 3653; // 10 years for TCPA / one/two-party recording defense

function sha256Hex(input: string, salt = ""): string {
  return createHash("sha256").update(salt + input).digest("hex");
}

export class ConsentSdk {
  constructor(private readonly opts: ConsentSdkOptions) {
    if (!opts.identifierHashSalt || opts.identifierHashSalt.length < 16) {
      throw new Error("ConsentSdk: identifierHashSalt must be >= 16 chars");
    }
  }

  /**
   * Capture a fresh consent record. Rejects if checkboxState is false — we
   * never record affirmative consent without an affirmative action.
   */
  async captureConsent(input: CaptureConsentInput): Promise<{ consentId: string; record: ConsentRecord }> {
    const parsed = CaptureConsentInputSchema.parse(input);
    if (!parsed.checkboxState) {
      throw new Error("ConsentSdk: cannot record consent — checkboxState was false (no affirmative action).");
    }

    const id = `cns_${randomUUID().replace(/-/g, "")}`;
    const givenAt = new Date();
    const retentionDays = this.retentionDaysFor(parsed.type);
    const retentionUntil = new Date(givenAt.getTime());
    retentionUntil.setUTCDate(retentionUntil.getUTCDate() + retentionDays);

    const identifierHash = sha256Hex(parsed.identifier.trim().toLowerCase(), this.opts.identifierHashSalt);
    const sourceIpHash = parsed.sourceIp ? sha256Hex(parsed.sourceIp, this.opts.identifierHashSalt) : null;

    const record: ConsentRecord = {
      id,
      workspaceId: parsed.workspaceId,
      type: parsed.type,
      identifier: parsed.identifier,
      identifierKind: parsed.identifierKind,
      identifierHash,
      scope: parsed.scope,
      source: parsed.source,
      sourceIpHash,
      userAgent: parsed.userAgent,
      consentTextVersion: parsed.consentTextVersion,
      consentTextHash: parsed.consentTextHash,
      proofArtifactUrl: parsed.proofArtifactUrl ?? null,
      purposes: parsed.purposes,
      contactId: parsed.contactId ?? null,
      givenAt: givenAt.toISOString(),
      withdrawnAt: null,
      withdrawnMethod: null,
      retentionUntil: retentionUntil.toISOString(),
    };

    await this.opts.store.put(record);
    return { consentId: id, record };
  }

  /**
   * Look up active consent for (workspace, type, identifier).
   * Returns null if the identifier never opted in OR has withdrawn.
   */
  async hasActiveConsent(input: {
    workspaceId: string;
    type: ConsentType;
    identifier: string;
  }): Promise<ConsentRecord | null> {
    const hash = sha256Hex(input.identifier.trim().toLowerCase(), this.opts.identifierHashSalt);
    return this.opts.store.latestActive(input.workspaceId, input.type, hash);
  }

  /** Retrieve all consent records for an identifier (export / DSR). */
  async retrieveForIdentifier(workspaceId: string, identifier: string): Promise<ConsentRecord[]> {
    const hash = sha256Hex(identifier.trim().toLowerCase(), this.opts.identifierHashSalt);
    return this.opts.store.listByIdentifier(workspaceId, hash);
  }

  /** Withdraw a specific consent (e.g., STOP received via SMS). */
  async withdrawConsent(id: string, method: ConsentWithdrawalMethod): Promise<void> {
    await this.opts.store.withdraw(id, new Date().toISOString(), method);
  }

  /**
   * Delete-my-data request. Honored within 24 hr per 05b.
   * Wipes all consent records for the identifier AND fires cascade hook
   * (which is expected to wipe contact PII, mark CRM tombstone, scrub from
   * search indexes, etc.).
   */
  async requestDeletion(input: { workspaceId: string; identifier: string }): Promise<{
    deletedConsentCount: number;
    identifierHash: string;
    completedAt: string;
  }> {
    const hash = sha256Hex(input.identifier.trim().toLowerCase(), this.opts.identifierHashSalt);
    const recs = await this.opts.store.listByIdentifier(input.workspaceId, hash);
    for (const r of recs) await this.opts.store.hardDelete(r.id);
    if (this.opts.cascadeHook) await this.opts.cascadeHook(input.workspaceId, hash);
    return { deletedConsentCount: recs.length, identifierHash: hash, completedAt: new Date().toISOString() };
  }

  /** Compute SHA-256 of a canonical consent text (helper for callers). */
  static hashConsentText(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  private retentionDaysFor(type: ConsentType): number {
    if (type === "marketing_sms" || type === "marketing_voice" || type === "call_recording") {
      return this.opts.smsVoiceRetentionDays ?? SMS_VOICE_RETENTION_DAYS;
    }
    return this.opts.defaultRetentionDays ?? DEFAULT_RETENTION_DAYS;
  }
}

/** Reference in-memory store — for tests + local dev. */
export class InMemoryConsentStore implements ConsentStore {
  private readonly records: ConsentRecord[] = [];

  async put(record: ConsentRecord): Promise<void> {
    this.records.push(record);
  }
  async latestActive(workspaceId: string, type: ConsentType, identifierHash: string): Promise<ConsentRecord | null> {
    const matches = this.records
      .filter(
        (r) =>
          r.workspaceId === workspaceId &&
          r.type === type &&
          r.identifierHash === identifierHash &&
          !r.withdrawnAt,
      )
      .sort((a, b) => b.givenAt.localeCompare(a.givenAt));
    return matches[0] ?? null;
  }
  async listByIdentifier(workspaceId: string, identifierHash: string): Promise<ConsentRecord[]> {
    return this.records.filter((r) => r.workspaceId === workspaceId && r.identifierHash === identifierHash);
  }
  async withdraw(id: string, withdrawnAt: string, method: ConsentWithdrawalMethod): Promise<void> {
    const rec = this.records.find((r) => r.id === id);
    if (!rec) return;
    rec.withdrawnAt = withdrawnAt;
    rec.withdrawnMethod = method;
  }
  async hardDelete(id: string): Promise<void> {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx >= 0) this.records.splice(idx, 1);
  }
}
