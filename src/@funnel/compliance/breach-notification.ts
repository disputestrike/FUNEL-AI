/**
 * Breach notification workflow.
 *
 * GDPR Art. 33 requires notification to the supervisory authority within 72
 * hours of becoming aware of a personal-data breach. Many US states require
 * similar (CCPA, varied state laws). This module implements:
 *
 *  - openBreach(): creates a breach record + starts the 72-hour clock
 *  - escalateInternal(): SOC notification + leadership chain
 *  - draftRegulatorNotice(): produces the GDPR-style notification text
 *  - notifyRegulators(): persists the notification + sends via the
 *    configured channel
 *  - notifyDataSubjects(): when high-risk to rights/freedoms (Art. 34)
 *  - closeBreach(): final report with root cause + remediation
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";

export const BreachSeveritySchema = z.enum(["informational", "low", "medium", "high", "critical"]);
export type BreachSeverity = z.infer<typeof BreachSeveritySchema>;

export const BreachKindSchema = z.enum([
  "unauthorized_access",
  "data_exfiltration",
  "ransomware",
  "credential_compromise",
  "insider_misuse",
  "third_party_breach",
  "accidental_disclosure",
  "system_misconfiguration",
  "lost_or_stolen_device",
]);
export type BreachKind = z.infer<typeof BreachKindSchema>;

export interface BreachRecord {
  id: string;
  openedAt: string;
  awareSinceAt: string; // GDPR clock start
  closedAt: string | null;
  severity: BreachSeverity;
  kind: BreachKind;
  summary: string;
  affectedDataCategories: string[]; // e.g. ['email','phone','consent_records']
  affectedSubjectCount: number | "unknown";
  affectedWorkspaces: string[];
  jurisdictionsImplicated: string[];
  highRiskToRights: boolean; // triggers Art. 34 individual notification
  containmentSteps: string[];
  rootCause: string | null;
  remediation: string | null;
  regulatorsNotified: RegulatorNotification[];
  subjectsNotified: SubjectNotification[];
  // GDPR 72-hour deadline:
  notificationDueAt: string;
}

export interface RegulatorNotification {
  authority: string; // e.g. 'IE-DPC','ICO','CNIL','CalAG'
  sentAt: string;
  reference: string;
  channel: "email" | "portal_submission" | "postal" | "phone";
}

export interface SubjectNotification {
  channel: "email" | "in_app" | "postal" | "sms";
  sentAt: string;
  templateVersion: string;
  recipientCount: number;
}

const NOTIFICATION_DEADLINE_HOURS = 72;

// Quick lookup of relevant supervisory authorities for common jurisdictions.
export const REGULATORS: Record<string, { authority: string; contactEmail: string; portalUrl: string }> = {
  EU: {
    authority: "Lead Supervisory Authority (via One-Stop-Shop)",
    contactEmail: "register-osa@edpb.europa.eu",
    portalUrl: "https://edpb.europa.eu/about-edpb/about-edpb/members_en",
  },
  IE: { authority: "Data Protection Commission (DPC)", contactEmail: "breaches@dataprotection.ie", portalUrl: "https://forms.dataprotection.ie/personal-data-breach" },
  UK: { authority: "Information Commissioner's Office (ICO)", contactEmail: "casework@ico.org.uk", portalUrl: "https://ico.org.uk/for-organisations/report-a-breach/" },
  DE: { authority: "BfDI / state-level DPAs", contactEmail: "poststelle@bfdi.bund.de", portalUrl: "https://www.bfdi.bund.de" },
  FR: { authority: "CNIL", contactEmail: "notifications-violations@cnil.fr", portalUrl: "https://notifications.cnil.fr/" },
  US: { authority: "FTC + State AGs (varies)", contactEmail: "datasecurity@ftc.gov", portalUrl: "https://reportfraud.ftc.gov/" },
  "US-CA": { authority: "California Attorney General", contactEmail: "privacy@doj.ca.gov", portalUrl: "https://oag.ca.gov/privacy" },
  "US-NY": { authority: "NY OAG", contactEmail: "privacy@ag.ny.gov", portalUrl: "https://ag.ny.gov/internet/data-breach" },
  BR: { authority: "ANPD", contactEmail: "encarregado@anpd.gov.br", portalUrl: "https://www.gov.br/anpd/pt-br" },
  IN: { authority: "DPB India", contactEmail: "support-dpb@meity.gov.in", portalUrl: "https://www.meity.gov.in" },
  AU: { authority: "OAIC", contactEmail: "enquiries@oaic.gov.au", portalUrl: "https://www.oaic.gov.au/privacy/notifiable-data-breaches" },
};

export interface BreachStore {
  put(record: BreachRecord): Promise<void>;
  update(id: string, patch: Partial<BreachRecord>): Promise<BreachRecord>;
  get(id: string): Promise<BreachRecord | null>;
  list(opts?: { open?: boolean }): Promise<BreachRecord[]>;
}

export interface BreachNotifierTransport {
  sendEmail(input: { to: string; subject: string; body: string; cc?: string[] }): Promise<void>;
  log(message: string, context: Record<string, unknown>): Promise<void>;
}

export class BreachNotificationService {
  constructor(
    private readonly store: BreachStore,
    private readonly transport: BreachNotifierTransport,
  ) {}

  async openBreach(input: {
    awareSinceAt?: string;
    severity: BreachSeverity;
    kind: BreachKind;
    summary: string;
    affectedDataCategories: string[];
    affectedSubjectCount: number | "unknown";
    affectedWorkspaces: string[];
    jurisdictionsImplicated: string[];
    highRiskToRights: boolean;
    containmentSteps?: string[];
  }): Promise<BreachRecord> {
    const now = new Date();
    const awareAt = input.awareSinceAt ? new Date(input.awareSinceAt) : now;
    const due = new Date(awareAt.getTime() + NOTIFICATION_DEADLINE_HOURS * 3600 * 1000);
    const record: BreachRecord = {
      id: `brc_${randomUUID().replace(/-/g, "")}`,
      openedAt: now.toISOString(),
      awareSinceAt: awareAt.toISOString(),
      closedAt: null,
      severity: input.severity,
      kind: input.kind,
      summary: input.summary,
      affectedDataCategories: input.affectedDataCategories,
      affectedSubjectCount: input.affectedSubjectCount,
      affectedWorkspaces: input.affectedWorkspaces,
      jurisdictionsImplicated: input.jurisdictionsImplicated,
      highRiskToRights: input.highRiskToRights,
      containmentSteps: input.containmentSteps ?? [],
      rootCause: null,
      remediation: null,
      regulatorsNotified: [],
      subjectsNotified: [],
      notificationDueAt: due.toISOString(),
    };
    await this.store.put(record);
    await this.transport.log("breach_opened", { id: record.id, severity: record.severity, due: record.notificationDueAt });
    return record;
  }

  /** Slack / pagerduty / leadership chain — fire on open. */
  async escalateInternal(record: BreachRecord, _additionalEmails: string[] = []): Promise<void> {
    const subject = `[BREACH] ${record.severity.toUpperCase()} — ${record.kind} — ${record.id}`;
    const body = [
      `Severity: ${record.severity}`,
      `Kind: ${record.kind}`,
      `Aware since: ${record.awareSinceAt}`,
      `GDPR/Art.33 deadline: ${record.notificationDueAt}`,
      `Affected categories: ${record.affectedDataCategories.join(", ")}`,
      `Affected subjects: ${record.affectedSubjectCount}`,
      `Jurisdictions implicated: ${record.jurisdictionsImplicated.join(", ")}`,
      `Summary: ${record.summary}`,
    ].join("\n");
    const escalationList = ["soc@gofunnelai.com", "ciso@gofunnelai.com", "general-counsel@gofunnelai.com", "ceo@gofunnelai.com"];
    for (const to of escalationList) {
      await this.transport.sendEmail({ to, subject, body });
    }
  }

  /** Render the standard 72-hour notice template. */
  draftRegulatorNotice(record: BreachRecord, authority: string): string {
    return [
      `Subject: GDPR Article 33 / equivalent — Personal Data Breach Notification`,
      ``,
      `1. Controller: GoFunnelAI, Inc. (DPO: dpo@gofunnelai.com)`,
      `2. Date of awareness: ${record.awareSinceAt}`,
      `3. Date of this notification: ${new Date().toISOString()}`,
      `4. Nature of the breach: ${record.kind} — ${record.summary}`,
      `5. Categories of data subjects affected: end users / customers / leads (P1/P2 PII).`,
      `6. Approximate number of data subjects affected: ${record.affectedSubjectCount}`,
      `7. Categories of personal data affected: ${record.affectedDataCategories.join(", ")}`,
      `8. Likely consequences of the breach: ${record.highRiskToRights ? "Material risk to rights/freedoms; direct subject notification under Art. 34 in progress." : "Limited; no high-risk to rights/freedoms identified."}`,
      `9. Measures taken or proposed: ${record.containmentSteps.join("; ") || "Investigation underway."}`,
      `10. Contact for further information: dpo@gofunnelai.com`,
      ``,
      `Authority addressed: ${authority}`,
      `Reference: ${record.id}`,
    ].join("\n");
  }

  async notifyRegulators(recordId: string): Promise<void> {
    const record = await this.store.get(recordId);
    if (!record) throw new Error("Breach not found.");
    const sent: RegulatorNotification[] = [...record.regulatorsNotified];
    for (const jur of record.jurisdictionsImplicated) {
      const reg = REGULATORS[jur];
      if (!reg) continue;
      const body = this.draftRegulatorNotice(record, reg.authority);
      await this.transport.sendEmail({
        to: reg.contactEmail,
        subject: `GDPR Art. 33 Notification — Breach ${record.id}`,
        body,
        cc: ["dpo@gofunnelai.com", "legal@gofunnelai.com"],
      });
      sent.push({
        authority: reg.authority,
        sentAt: new Date().toISOString(),
        reference: record.id,
        channel: "email",
      });
    }
    await this.store.update(recordId, { regulatorsNotified: sent });
  }

  /** Art. 34: notify data subjects when high-risk to rights/freedoms. */
  async notifyDataSubjects(input: {
    recordId: string;
    channel: SubjectNotification["channel"];
    templateVersion: string;
    recipientCount: number;
  }): Promise<void> {
    const record = await this.store.get(input.recordId);
    if (!record) throw new Error("Breach not found.");
    const next: SubjectNotification[] = [
      ...record.subjectsNotified,
      {
        channel: input.channel,
        sentAt: new Date().toISOString(),
        templateVersion: input.templateVersion,
        recipientCount: input.recipientCount,
      },
    ];
    await this.store.update(input.recordId, { subjectsNotified: next });
  }

  async closeBreach(input: { recordId: string; rootCause: string; remediation: string }): Promise<BreachRecord> {
    return this.store.update(input.recordId, {
      closedAt: new Date().toISOString(),
      rootCause: input.rootCause,
      remediation: input.remediation,
    });
  }

  /** Helper for ops: which open breaches are at risk of missing the 72-hour clock? */
  async openAtRisk(thresholdHoursToDeadline = 12): Promise<BreachRecord[]> {
    const list = await this.store.list({ open: true });
    return list.filter((r) => Date.parse(r.notificationDueAt) - Date.now() < thresholdHoursToDeadline * 3600 * 1000);
  }
}

export class InMemoryBreachStore implements BreachStore {
  private readonly map = new Map<string, BreachRecord>();
  async put(record: BreachRecord): Promise<void> {
    this.map.set(record.id, record);
  }
  async update(id: string, patch: Partial<BreachRecord>): Promise<BreachRecord> {
    const cur = this.map.get(id);
    if (!cur) throw new Error("not found");
    const next = { ...cur, ...patch };
    this.map.set(id, next);
    return next;
  }
  async get(id: string): Promise<BreachRecord | null> {
    return this.map.get(id) ?? null;
  }
  async list(opts: { open?: boolean } = {}): Promise<BreachRecord[]> {
    const out: BreachRecord[] = [];
    for (const r of this.map.values()) {
      if (opts.open === undefined || (opts.open ? r.closedAt === null : r.closedAt !== null)) out.push(r);
    }
    return out;
  }
}
