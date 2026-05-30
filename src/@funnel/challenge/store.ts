import type { Cohort, DayProgress, Participant, Submission } from "./types.js";

export interface ChallengeStore {
  /* Cohorts */
  insertCohort(c: Cohort): Promise<Cohort>;
  getCohortById(id: string): Promise<Cohort | null>;
  getCurrentRunningCohort(): Promise<Cohort | null>;
  getNextScheduledCohort(): Promise<Cohort | null>;
  updateCohortStatus(id: string, status: Cohort["status"]): Promise<Cohort>;
  incrementCohortCounter(id: string, field: keyof Pick<Cohort, "enrolled_count" | "funnels_shipped_count" | "leads_generated_count" | "paid_conversion_count">, by: number): Promise<void>;

  /* Participants */
  insertParticipant(p: Participant): Promise<Participant>;
  getParticipantById(id: string): Promise<Participant | null>;
  getParticipantByEmail(cohort_id: string, email: string): Promise<Participant | null>;
  listCohortParticipants(cohort_id: string): Promise<Participant[]>;
  updateParticipant(id: string, patch: Partial<Participant>): Promise<Participant>;

  /* Submissions */
  insertSubmission(s: Submission): Promise<Submission>;
  listSubmissionsForParticipant(participant_id: string): Promise<Submission[]>;

  /* DayProgress (materialized) */
  upsertDayProgress(d: DayProgress): Promise<DayProgress>;
  listCohortDayProgress(cohort_id: string): Promise<DayProgress[]>;
}

export class InMemoryChallengeStore implements ChallengeStore {
  private cohorts = new Map<string, Cohort>();
  private participants = new Map<string, Participant>();
  private subs = new Map<string, Submission>();
  private progress = new Map<string, DayProgress>(); // key cohort_id:day

  async insertCohort(c: Cohort): Promise<Cohort> {
    this.cohorts.set(c.id, c);
    return c;
  }
  async getCohortById(id: string): Promise<Cohort | null> {
    return this.cohorts.get(id) ?? null;
  }
  async getCurrentRunningCohort(): Promise<Cohort | null> {
    for (const c of this.cohorts.values()) if (c.status === "running") return c;
    return null;
  }
  async getNextScheduledCohort(): Promise<Cohort | null> {
    return [...this.cohorts.values()]
      .filter((c) => c.status === "scheduled")
      .sort((a, b) => a.day1_at.localeCompare(b.day1_at))[0] ?? null;
  }
  async updateCohortStatus(id: string, status: Cohort["status"]): Promise<Cohort> {
    const c = this.cohorts.get(id);
    if (!c) throw new Error("cohort not found");
    const n = { ...c, status };
    this.cohorts.set(id, n);
    return n;
  }
  async incrementCohortCounter(id: string, field: keyof Pick<Cohort, "enrolled_count" | "funnels_shipped_count" | "leads_generated_count" | "paid_conversion_count">, by: number): Promise<void> {
    const c = this.cohorts.get(id);
    if (!c) return;
    const next = { ...c, [field]: c[field] + by };
    this.cohorts.set(id, next);
  }

  async insertParticipant(p: Participant): Promise<Participant> {
    this.participants.set(p.id, p);
    return p;
  }
  async getParticipantById(id: string): Promise<Participant | null> {
    return this.participants.get(id) ?? null;
  }
  async getParticipantByEmail(cohort_id: string, email: string): Promise<Participant | null> {
    const lo = email.toLowerCase();
    for (const p of this.participants.values()) {
      if (p.cohort_id === cohort_id && p.email.toLowerCase() === lo) return p;
    }
    return null;
  }
  async listCohortParticipants(cohort_id: string): Promise<Participant[]> {
    return [...this.participants.values()].filter((p) => p.cohort_id === cohort_id);
  }
  async updateParticipant(id: string, patch: Partial<Participant>): Promise<Participant> {
    const cur = this.participants.get(id);
    if (!cur) throw new Error("participant not found");
    const n = { ...cur, ...patch };
    this.participants.set(id, n);
    return n;
  }

  async insertSubmission(s: Submission): Promise<Submission> {
    this.subs.set(s.id, s);
    return s;
  }
  async listSubmissionsForParticipant(participant_id: string): Promise<Submission[]> {
    return [...this.subs.values()].filter((s) => s.participant_id === participant_id);
  }

  async upsertDayProgress(d: DayProgress): Promise<DayProgress> {
    this.progress.set(`${d.cohort_id}:${d.day}`, d);
    return d;
  }
  async listCohortDayProgress(cohort_id: string): Promise<DayProgress[]> {
    return [...this.progress.values()].filter((p) => p.cohort_id === cohort_id);
  }
}
