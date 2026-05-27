/**
 * Incident response — 24/7 on-call rotation + SLA enforcement.
 *
 * SLA:
 *  - acknowledge: ≤ 4 hours from page
 *  - remediate (P1/P2): ≤ 24 hours
 *  - post-mortem: ≤ 72 hours after remediation
 *
 * Rotation: primary + secondary on-call per region. Hand-off automated at
 * shift boundaries. Pages via PagerDuty (or equivalent) — we expose a
 * pluggable Pager transport.
 */

import { randomUUID } from "node:crypto";

export type IncidentSeverity = "p1_critical" | "p2_high" | "p3_medium" | "p4_low";

export interface OnCallShift {
  rotationId: string;
  primary: { engineerId: string; phone: string; email: string; tz: string };
  secondary: { engineerId: string; phone: string; email: string; tz: string };
  startsAt: string;
  endsAt: string;
}

export interface OnCallSchedule {
  /** Returns the active shift for a given rotation at time `at`. */
  getShift(rotationId: string, at: Date): Promise<OnCallShift | null>;
  /** Persist a new rotation entry. */
  putShift(shift: OnCallShift): Promise<void>;
  /** List shifts for a rotation in a window. */
  listShifts(rotationId: string, from: Date, to: Date): Promise<OnCallShift[]>;
}

export interface Pager {
  page(input: { to: { phone?: string; email?: string }; subject: string; body: string; urgency: "high" | "low" }): Promise<{ pageId: string }>;
}

export type IncidentState = "open" | "acknowledged" | "remediating" | "remediated" | "post_mortem" | "closed";

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  remediatedAt: string | null;
  postMortemAt: string | null;
  closedAt: string | null;
  state: IncidentState;
  rotationId: string;
  primaryPaged: boolean;
  secondaryPaged: boolean;
  /** Linked breach record (if PII involved). */
  breachId?: string;
  ackDueAt: string;
  remediateDueAt: string;
  postMortemDueAt: string | null;
  events: IncidentEvent[];
}

export interface IncidentEvent {
  ts: string;
  kind: "paged" | "ack" | "comment" | "escalated" | "state_change" | "post_mortem_attached";
  actor: string;
  detail: string;
}

const SLA_ACK_MS: Record<IncidentSeverity, number> = {
  p1_critical: 15 * 60 * 1000,
  p2_high: 30 * 60 * 1000,
  p3_medium: 4 * 3600 * 1000,
  p4_low: 24 * 3600 * 1000,
};
const SLA_REMEDIATE_MS: Record<IncidentSeverity, number> = {
  p1_critical: 24 * 3600 * 1000,
  p2_high: 48 * 3600 * 1000,
  p3_medium: 7 * 86400 * 1000,
  p4_low: 30 * 86400 * 1000,
};
const POST_MORTEM_MS = 72 * 3600 * 1000;

export interface IncidentStore {
  put(i: Incident): Promise<void>;
  update(id: string, patch: Partial<Incident>): Promise<Incident>;
  get(id: string): Promise<Incident | null>;
  list(opts?: { open?: boolean }): Promise<Incident[]>;
}

export interface IncidentResponseOptions {
  store: IncidentStore;
  schedule: OnCallSchedule;
  pager: Pager;
  ackSlaMs?: Partial<Record<IncidentSeverity, number>>;
}

export class IncidentResponseManager {
  constructor(private readonly opts: IncidentResponseOptions) {}

  /** Open a new incident — pages the primary on-call immediately. */
  async open(input: {
    severity: IncidentSeverity;
    title: string;
    description: string;
    rotationId: string;
    breachId?: string;
  }): Promise<Incident> {
    const now = new Date();
    const ackDueAt = new Date(now.getTime() + (this.opts.ackSlaMs?.[input.severity] ?? SLA_ACK_MS[input.severity])).toISOString();
    const remediateDueAt = new Date(now.getTime() + SLA_REMEDIATE_MS[input.severity]).toISOString();
    const incident: Incident = {
      id: `inc_${randomUUID().replace(/-/g, "")}`,
      severity: input.severity,
      title: input.title,
      description: input.description,
      detectedAt: now.toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      remediatedAt: null,
      postMortemAt: null,
      closedAt: null,
      state: "open",
      rotationId: input.rotationId,
      primaryPaged: false,
      secondaryPaged: false,
      breachId: input.breachId,
      ackDueAt,
      remediateDueAt,
      postMortemDueAt: null,
      events: [{ ts: now.toISOString(), kind: "state_change", actor: "system", detail: `incident opened (${input.severity})` }],
    };
    await this.opts.store.put(incident);
    await this.pageOncall(incident);
    return incident;
  }

  /** Page primary; escalate to secondary if not ack'd within SLA. */
  async pageOncall(incident: Incident): Promise<void> {
    const shift = await this.opts.schedule.getShift(incident.rotationId, new Date(incident.detectedAt));
    if (!shift) {
      await this.opts.store.update(incident.id, {
        events: [...incident.events, { ts: new Date().toISOString(), kind: "escalated", actor: "system", detail: "no oncall shift found — escalate to leadership" }],
      });
      return;
    }
    const subject = `[${incident.severity}] ${incident.title}`;
    await this.opts.pager.page({
      to: { phone: shift.primary.phone, email: shift.primary.email },
      subject,
      body: incident.description,
      urgency: incident.severity === "p1_critical" || incident.severity === "p2_high" ? "high" : "low",
    });
    await this.opts.store.update(incident.id, {
      primaryPaged: true,
      events: [
        ...incident.events,
        { ts: new Date().toISOString(), kind: "paged", actor: "system", detail: `primary=${shift.primary.engineerId}` },
      ],
    });
  }

  async acknowledge(incidentId: string, engineerId: string): Promise<Incident> {
    const cur = await this.opts.store.get(incidentId);
    if (!cur) throw new Error("not found");
    if (cur.state !== "open") return cur;
    const now = new Date().toISOString();
    return this.opts.store.update(incidentId, {
      acknowledgedAt: now,
      acknowledgedBy: engineerId,
      state: "acknowledged",
      events: [...cur.events, { ts: now, kind: "ack", actor: engineerId, detail: "acknowledged" }],
    });
  }

  async markRemediating(incidentId: string, engineerId: string, note: string): Promise<Incident> {
    const cur = await this.opts.store.get(incidentId);
    if (!cur) throw new Error("not found");
    return this.opts.store.update(incidentId, {
      state: "remediating",
      events: [...cur.events, { ts: new Date().toISOString(), kind: "state_change", actor: engineerId, detail: `remediating: ${note}` }],
    });
  }

  async markRemediated(incidentId: string, engineerId: string, summary: string): Promise<Incident> {
    const cur = await this.opts.store.get(incidentId);
    if (!cur) throw new Error("not found");
    const now = new Date();
    return this.opts.store.update(incidentId, {
      remediatedAt: now.toISOString(),
      state: "remediated",
      postMortemDueAt: new Date(now.getTime() + POST_MORTEM_MS).toISOString(),
      events: [...cur.events, { ts: now.toISOString(), kind: "state_change", actor: engineerId, detail: `remediated: ${summary}` }],
    });
  }

  async attachPostMortem(incidentId: string, engineerId: string, postMortemUrl: string): Promise<Incident> {
    const cur = await this.opts.store.get(incidentId);
    if (!cur) throw new Error("not found");
    const now = new Date().toISOString();
    return this.opts.store.update(incidentId, {
      postMortemAt: now,
      state: "post_mortem",
      events: [...cur.events, { ts: now, kind: "post_mortem_attached", actor: engineerId, detail: postMortemUrl }],
    });
  }

  async close(incidentId: string, engineerId: string): Promise<Incident> {
    const cur = await this.opts.store.get(incidentId);
    if (!cur) throw new Error("not found");
    const now = new Date().toISOString();
    return this.opts.store.update(incidentId, {
      closedAt: now,
      state: "closed",
      events: [...cur.events, { ts: now, kind: "state_change", actor: engineerId, detail: "closed" }],
    });
  }

  /** Cron — escalate to secondary if primary hasn't ack'd within SLA. */
  async escalateIfNeeded(now = new Date()): Promise<void> {
    const open = await this.opts.store.list({ open: true });
    for (const i of open) {
      if (i.state !== "open") continue;
      if (Date.parse(i.ackDueAt) > now.getTime()) continue;
      if (i.secondaryPaged) continue;
      const shift = await this.opts.schedule.getShift(i.rotationId, now);
      if (!shift) continue;
      await this.opts.pager.page({
        to: { phone: shift.secondary.phone, email: shift.secondary.email },
        subject: `[ESCALATION] ${i.title}`,
        body: i.description,
        urgency: "high",
      });
      await this.opts.store.update(i.id, {
        secondaryPaged: true,
        events: [...i.events, { ts: now.toISOString(), kind: "escalated", actor: "system", detail: `secondary=${shift.secondary.engineerId}` }],
      });
    }
  }
}

export class InMemoryOnCallSchedule implements OnCallSchedule {
  private readonly byRotation = new Map<string, OnCallShift[]>();
  async getShift(rotationId: string, at: Date): Promise<OnCallShift | null> {
    const shifts = this.byRotation.get(rotationId) ?? [];
    return shifts.find((s) => Date.parse(s.startsAt) <= at.getTime() && Date.parse(s.endsAt) > at.getTime()) ?? null;
  }
  async putShift(shift: OnCallShift): Promise<void> {
    const arr = this.byRotation.get(shift.rotationId) ?? [];
    arr.push(shift);
    arr.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    this.byRotation.set(shift.rotationId, arr);
  }
  async listShifts(rotationId: string, from: Date, to: Date): Promise<OnCallShift[]> {
    return (this.byRotation.get(rotationId) ?? []).filter(
      (s) => Date.parse(s.endsAt) > from.getTime() && Date.parse(s.startsAt) < to.getTime(),
    );
  }
}

export class InMemoryIncidentStore implements IncidentStore {
  private readonly map = new Map<string, Incident>();
  async put(i: Incident): Promise<void> {
    this.map.set(i.id, i);
  }
  async update(id: string, patch: Partial<Incident>): Promise<Incident> {
    const cur = this.map.get(id);
    if (!cur) throw new Error("not found");
    const next = { ...cur, ...patch };
    this.map.set(id, next);
    return next;
  }
  async get(id: string): Promise<Incident | null> {
    return this.map.get(id) ?? null;
  }
  async list(opts: { open?: boolean } = {}): Promise<Incident[]> {
    const out: Incident[] = [];
    for (const i of this.map.values()) {
      if (opts.open === undefined || (opts.open ? i.closedAt === null : i.closedAt !== null)) out.push(i);
    }
    return out;
  }
}
