/**
 * Human Review Queue (docs/07b).
 *
 * Backing API for the reviewer dashboard at review.gofunnelai.com. Implements
 * state machine, SLA tracking, claim-and-lock semantics, structured
 * decisions, calibration audit sampling, appeals workflow.
 *
 * Generations in `review_required` are paused — cost meter pauses (07c),
 * downstream publish + send jobs blocked. The orchestrator polls this
 * queue's state via subscribeStateChange (event-driven in prod).
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";

export type ReviewState =
  | "review_required"
  | "claimed"
  | "approved"
  | "approved_with_edits"
  | "rejected"
  | "appeal_review"
  | "appeal_granted"
  | "appeal_denied"
  | "escalated"
  | "escalated_to_legal"
  | "escalated_resolved";

export const ReviewerTierSchema = z.enum(["tier_1", "tier_2", "legal_counsel"]);
export type ReviewerTier = z.infer<typeof ReviewerTierSchema>;

export const CustomerTierSchema = z.enum(["free", "starter", "growth", "scale", "agency"]);
export type CustomerTier = z.infer<typeof CustomerTierSchema>;

export const RejectionReasonSchema = z.enum([
  "unsubstantiated_outcome_claim",
  "unsupported_superlative",
  "guarantee_language_not_permitted_in_industry",
  "before_after_imagery_not_permitted",
  "protected_class_targeting",
  "impersonation_brand_or_government",
  "missing_required_disclaimer",
  "missing_state_license_proof",
  "ad_platform_policy_violation_meta",
  "ad_platform_policy_violation_google",
  "testimonial_without_substantiation",
  "testimonial_implying_typical_result",
  "consent_proof_insufficient",
  "domain_age_or_reputation_concern",
  "offer_category_not_supported",
  "other_see_details",
]);
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export interface ReviewItem {
  id: string;
  generationId: string;
  workspaceId: string;
  funnelId: string;
  customerTier: CustomerTier;
  vertical: string;
  /** Why this was queued — copies of compliance/T&S trigger codes. */
  triggers: string[];
  /** 1=highest, 5=lowest. */
  priority: 1 | 2 | 3 | 4 | 5;
  state: ReviewState;
  /** Reviewer who currently has the lock, if any. */
  claimedByReviewerId: string | null;
  claimedAt: string | null;
  /** Lock auto-releases after 15min idle. */
  claimExpiresAt: string | null;
  /** SLA deadline. */
  slaDueAt: string;
  /** Internal-use only — kb pack version used in original generation. */
  kbPackVersion?: string;
  /** Total reviewer time for analytics. */
  timeToDecisionSec: number | null;
  enqueuedAt: string;
  decidedAt: string | null;
  decidedByReviewerId: string | null;
  decisionReasons: RejectionReason[];
  decisionFreeText: string | null;
  editsDiff: Record<string, unknown> | null;
  /** Cycle counter — re-checks after approve_with_edits, max 2. */
  autoCheckCycles: number;
  appealedAt: string | null;
  appealOutcome: "appeal_granted" | "appeal_denied" | null;
  /** Was this item flagged as a QA / calibration test? (10% sample, plus adversarial). */
  isCalibrationTest: boolean;
  goldDecision: RejectionReason[] | "approve" | null;
}

interface SlaPolicy {
  businessHoursSec: number;
  afterHoursSec: number;
}

const SLA_BY_TIER: Record<CustomerTier, SlaPolicy> = {
  free: { businessHoursSec: 4 * 3600, afterHoursSec: 24 * 3600 },
  starter: { businessHoursSec: 4 * 3600, afterHoursSec: 24 * 3600 },
  growth: { businessHoursSec: 2 * 3600, afterHoursSec: 12 * 3600 },
  scale: { businessHoursSec: 1 * 3600, afterHoursSec: 4 * 3600 },
  agency: { businessHoursSec: 1 * 3600, afterHoursSec: 4 * 3600 },
};

const CLAIM_LOCK_MS = 15 * 60 * 1_000;

/** Is `at` within US business hours (Mon–Fri 8a–6p PT)? Coarse — production uses tz-aware. */
function inBusinessHours(at: Date): boolean {
  const pt = new Date(at.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = pt.getDay();
  const hour = pt.getHours();
  if (day === 0 || day === 6) return false;
  return hour >= 8 && hour < 18;
}

export interface ReviewQueueStore {
  put(item: ReviewItem): Promise<void>;
  get(id: string): Promise<ReviewItem | null>;
  getByGenerationId(generationId: string): Promise<ReviewItem | null>;
  /** List items by state, sorted by priority asc, then sla asc. */
  listByState(state: ReviewState, limit?: number): Promise<ReviewItem[]>;
  /** Update — caller mutates and passes back; we serialize. */
  update(id: string, patch: Partial<ReviewItem>): Promise<ReviewItem>;
}

export interface AppealStore {
  filed(appeal: AppealRecord): Promise<void>;
  get(generationId: string): Promise<AppealRecord | null>;
  decide(generationId: string, outcome: "appeal_granted" | "appeal_denied", reviewerId: string, notes: string): Promise<void>;
}

export interface AppealRecord {
  generationId: string;
  workspaceId: string;
  customerUserId: string;
  rationale: string;
  evidenceUrls: string[];
  recuseReviewerId?: string;
  filedAt: string;
  outcome: "appeal_granted" | "appeal_denied" | null;
  decidedByReviewerId: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
}

export interface ReviewQueueEvents {
  /** Cost-governor + orchestrator listeners. */
  onEnqueued(item: ReviewItem): Promise<void>;
  onClaimed(item: ReviewItem): Promise<void>;
  onDecided(item: ReviewItem): Promise<void>;
  onSlaAtRisk(item: ReviewItem): Promise<void>;
  onSlaBreached(item: ReviewItem): Promise<void>;
}

export interface HumanReviewQueueOptions {
  store: ReviewQueueStore;
  appealStore: AppealStore;
  events?: Partial<ReviewQueueEvents>;
  /** 10% of decisions sampled for tier-2 audit. */
  calibrationSampleRate?: number;
  /** Maximum cycles through auto_check after approve_with_edits. */
  maxAutoCheckCycles?: number;
  /** Appeal eligibility window in days. */
  appealWindowDays?: number;
}

export class HumanReviewQueue {
  constructor(private readonly opts: HumanReviewQueueOptions) {}

  /** Enqueue a generation for review. PAUSES the cost meter (via event). */
  async enqueueForReview(input: {
    generationId: string;
    workspaceId: string;
    funnelId: string;
    customerTier: CustomerTier;
    vertical: string;
    triggers: string[];
    priority?: 1 | 2 | 3 | 4 | 5;
    kbPackVersion?: string;
  }): Promise<ReviewItem> {
    if (input.triggers.length === 0) throw new Error("enqueueForReview: triggers array must be non-empty");

    const existing = await this.opts.store.getByGenerationId(input.generationId);
    if (existing && existing.state === "review_required") return existing;

    const now = new Date();
    const sla = SLA_BY_TIER[input.customerTier];
    const slaSec = inBusinessHours(now) ? sla.businessHoursSec : sla.afterHoursSec;
    const slaDueAt = new Date(now.getTime() + slaSec * 1000).toISOString();

    const calibrationRate = this.opts.calibrationSampleRate ?? 0.1;
    const isCalibrationTest = Math.random() < calibrationRate;

    const item: ReviewItem = {
      id: `rvi_${randomUUID().replace(/-/g, "")}`,
      generationId: input.generationId,
      workspaceId: input.workspaceId,
      funnelId: input.funnelId,
      customerTier: input.customerTier,
      vertical: input.vertical,
      triggers: input.triggers,
      priority: input.priority ?? this.defaultPriority(input.customerTier, input.triggers),
      state: "review_required",
      claimedByReviewerId: null,
      claimedAt: null,
      claimExpiresAt: null,
      slaDueAt,
      kbPackVersion: input.kbPackVersion,
      timeToDecisionSec: null,
      enqueuedAt: now.toISOString(),
      decidedAt: null,
      decidedByReviewerId: null,
      decisionReasons: [],
      decisionFreeText: null,
      editsDiff: null,
      autoCheckCycles: 0,
      appealedAt: null,
      appealOutcome: null,
      isCalibrationTest,
      goldDecision: null,
    };
    await this.opts.store.put(item);
    if (this.opts.events?.onEnqueued) await this.opts.events.onEnqueued(item);
    return item;
  }

  /** Reviewer dashboard: list items the given reviewer can work on. */
  async listPending(_reviewerId: string, opts: { limit?: number; tier?: ReviewerTier } = {}): Promise<ReviewItem[]> {
    const limit = opts.limit ?? 50;
    const items = await this.opts.store.listByState("review_required", limit);
    // Sort by SLA risk + priority
    items.sort((a, b) => {
      const aMs = Date.parse(a.slaDueAt) - Date.now();
      const bMs = Date.parse(b.slaDueAt) - Date.now();
      if (a.priority !== b.priority) return a.priority - b.priority;
      return aMs - bMs;
    });
    return items;
  }

  /** Reviewer claims an item — establishes 15-minute lock. */
  async claim(generationId: string, reviewerId: string): Promise<ReviewItem> {
    const item = await this.opts.store.getByGenerationId(generationId);
    if (!item) throw new Error(`No review item for generation ${generationId}`);
    if (item.state !== "review_required") throw new Error(`Item not claimable, state=${item.state}`);
    if (item.claimedByReviewerId && item.claimedByReviewerId !== reviewerId) {
      // Check whether the existing lock expired
      const exp = item.claimExpiresAt ? Date.parse(item.claimExpiresAt) : 0;
      if (exp > Date.now()) throw new Error("Item is locked by another reviewer.");
    }
    const now = new Date();
    const patched = await this.opts.store.update(item.id, {
      claimedByReviewerId: reviewerId,
      claimedAt: now.toISOString(),
      claimExpiresAt: new Date(now.getTime() + CLAIM_LOCK_MS).toISOString(),
      state: "claimed",
    });
    if (this.opts.events?.onClaimed) await this.opts.events.onClaimed(patched);
    return patched;
  }

  async approve(
    generationId: string,
    reviewerId: string,
    opts: { edits?: Record<string, unknown> } = {},
  ): Promise<ReviewItem> {
    const item = await this.requireClaimedBy(generationId, reviewerId);
    const now = new Date();
    const ttd = item.claimedAt ? Math.floor((now.getTime() - Date.parse(item.claimedAt)) / 1000) : null;
    const state: ReviewState = opts.edits ? "approved_with_edits" : "approved";
    let cycles = item.autoCheckCycles;
    if (opts.edits) {
      cycles += 1;
      if (cycles > (this.opts.maxAutoCheckCycles ?? 2)) {
        throw new Error("Max approve_with_edits cycles exceeded — must reject or escalate.");
      }
    }
    const patched = await this.opts.store.update(item.id, {
      state,
      decidedAt: now.toISOString(),
      decidedByReviewerId: reviewerId,
      timeToDecisionSec: ttd,
      editsDiff: opts.edits ?? null,
      autoCheckCycles: cycles,
      claimedByReviewerId: null,
      claimExpiresAt: null,
    });
    if (this.opts.events?.onDecided) await this.opts.events.onDecided(patched);
    return patched;
  }

  async reject(
    generationId: string,
    reviewerId: string,
    opts: { reasons: RejectionReason[]; freeText?: string },
  ): Promise<ReviewItem> {
    if (opts.reasons.length === 0) throw new Error("reject: at least one reason required.");
    if (opts.reasons.includes("other_see_details") && !opts.freeText) {
      throw new Error("reject: free-text required when other_see_details is selected.");
    }
    opts.reasons.forEach((r) => RejectionReasonSchema.parse(r));
    const item = await this.requireClaimedBy(generationId, reviewerId);
    const now = new Date();
    const ttd = item.claimedAt ? Math.floor((now.getTime() - Date.parse(item.claimedAt)) / 1000) : null;
    const patched = await this.opts.store.update(item.id, {
      state: "rejected",
      decidedAt: now.toISOString(),
      decidedByReviewerId: reviewerId,
      decisionReasons: opts.reasons,
      decisionFreeText: opts.freeText ?? null,
      timeToDecisionSec: ttd,
      claimedByReviewerId: null,
      claimExpiresAt: null,
    });
    if (this.opts.events?.onDecided) await this.opts.events.onDecided(patched);
    return patched;
  }

  async escalate(
    generationId: string,
    reviewerId: string,
    level: "tier_2_lead" | "legal_counsel" | "t&s_policy_question",
    notes?: string,
  ): Promise<ReviewItem> {
    const item = await this.requireClaimedBy(generationId, reviewerId);
    const next: ReviewState = level === "legal_counsel" ? "escalated_to_legal" : "escalated";
    const patched = await this.opts.store.update(item.id, {
      state: next,
      decisionFreeText: notes ?? null,
      claimedByReviewerId: null,
      claimExpiresAt: null,
    });
    if (this.opts.events?.onDecided) await this.opts.events.onDecided(patched);
    return patched;
  }

  /** Customer appeals a rejection. Eligibility: within `appealWindowDays`. */
  async fileAppeal(input: {
    generationId: string;
    customerUserId: string;
    rationale: string;
    evidenceUrls?: string[];
    recuseReviewerId?: string;
  }): Promise<AppealRecord> {
    const item = await this.opts.store.getByGenerationId(input.generationId);
    if (!item) throw new Error(`No review item for generation ${input.generationId}`);
    if (item.state !== "rejected") throw new Error(`Cannot appeal — current state ${item.state}`);
    if (item.decidedAt) {
      const ageDays = (Date.now() - Date.parse(item.decidedAt)) / 86_400_000;
      if (ageDays > (this.opts.appealWindowDays ?? 7)) {
        throw new Error("Appeal window expired (7 days).");
      }
    }
    if (input.rationale.length > 2000) throw new Error("Appeal rationale exceeds 2000 chars.");

    const appeal: AppealRecord = {
      generationId: input.generationId,
      workspaceId: item.workspaceId,
      customerUserId: input.customerUserId,
      rationale: input.rationale,
      evidenceUrls: input.evidenceUrls ?? [],
      recuseReviewerId: input.recuseReviewerId,
      filedAt: new Date().toISOString(),
      outcome: null,
      decidedByReviewerId: null,
      decidedAt: null,
      decisionNotes: null,
    };
    await this.opts.appealStore.filed(appeal);
    await this.opts.store.update(item.id, { state: "appeal_review", appealedAt: appeal.filedAt });
    return appeal;
  }

  async decideAppeal(input: {
    generationId: string;
    reviewerId: string;
    outcome: "appeal_granted" | "appeal_denied";
    notes: string;
  }): Promise<ReviewItem> {
    const item = await this.opts.store.getByGenerationId(input.generationId);
    if (!item) throw new Error("Item not found.");
    if (item.state !== "appeal_review") throw new Error(`Item not under appeal — state=${item.state}`);

    await this.opts.appealStore.decide(input.generationId, input.outcome, input.reviewerId, input.notes);

    const nextState: ReviewState =
      input.outcome === "appeal_granted" ? "approved" : "appeal_denied";
    const patched = await this.opts.store.update(item.id, {
      state: nextState,
      appealOutcome: input.outcome,
    });
    if (this.opts.events?.onDecided) await this.opts.events.onDecided(patched);
    return patched;
  }

  /** Check / fire SLA risk alerts for every pending item. Cron at 1-min cadence. */
  async tickSlaWatchdog(now = new Date()): Promise<void> {
    const items = await this.opts.store.listByState("review_required", 1000);
    for (const item of items) {
      const due = Date.parse(item.slaDueAt);
      const ms = due - now.getTime();
      if (ms < 0 && this.opts.events?.onSlaBreached) await this.opts.events.onSlaBreached(item);
      else if (ms < 30 * 60 * 1000 && this.opts.events?.onSlaAtRisk) await this.opts.events.onSlaAtRisk(item);
    }
  }

  /** Customer-facing estimate of resolution time. */
  async estimateWaitMs(item: ReviewItem, _reviewerThroughputPerHour = 7): Promise<number> {
    // Naive: assume queue depth Ã— avg decision time / reviewers.
    const queue = await this.opts.store.listByState("review_required", 5000);
    const ahead = queue.filter((q) => q.priority <= item.priority && q.enqueuedAt < item.enqueuedAt).length;
    return Math.max(0, Math.round((ahead / 3) * 8 * 60 * 1000));
  }

  /**
   * Reviewer QA metrics — accuracy vs gold (calibration), median TTD, SLA
   * breach rate, appeal-reversal rate over the window.
   */
  async metrics(
    reviewerId: string,
    windowHours = 24 * 7,
  ): Promise<{
    decisionCount: number;
    medianTtdSec: number | null;
    accuracyVsGold: number | null;
    slaBreachRate: number;
    reversalRate: number;
  }> {
    const sinceMs = Date.now() - windowHours * 3600 * 1000;
    const all = (await this.opts.store.listByState("approved", 5000))
      .concat(await this.opts.store.listByState("approved_with_edits", 5000))
      .concat(await this.opts.store.listByState("rejected", 5000))
      .concat(await this.opts.store.listByState("appeal_granted", 5000))
      .concat(await this.opts.store.listByState("appeal_denied", 5000));
    const mine = all.filter((i) => i.decidedByReviewerId === reviewerId && i.decidedAt && Date.parse(i.decidedAt) > sinceMs);
    const ttds = mine.map((i) => i.timeToDecisionSec).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
    const median = ttds.length ? ttds[Math.floor(ttds.length / 2)]! : null;
    const calibration = mine.filter((i) => i.isCalibrationTest && i.goldDecision !== null);
    let correct = 0;
    for (const c of calibration) {
      const isApprove = c.state === "approved" || c.state === "approved_with_edits";
      if (c.goldDecision === "approve" && isApprove) correct += 1;
      else if (Array.isArray(c.goldDecision) && c.state === "rejected") {
        // overlap counts
        const overlap = c.goldDecision.some((r) => c.decisionReasons.includes(r));
        if (overlap) correct += 1;
      }
    }
    const accuracy = calibration.length ? correct / calibration.length : null;
    const slaBreaches = mine.filter((i) => i.decidedAt && Date.parse(i.decidedAt) > Date.parse(i.slaDueAt)).length;
    const slaRate = mine.length ? slaBreaches / mine.length : 0;

    const reversed = mine.filter((i) => i.appealOutcome === "appeal_granted").length;
    const reversalRate = mine.length ? reversed / mine.length : 0;

    return {
      decisionCount: mine.length,
      medianTtdSec: median,
      accuracyVsGold: accuracy,
      slaBreachRate: slaRate,
      reversalRate,
    };
  }

  private async requireClaimedBy(generationId: string, reviewerId: string): Promise<ReviewItem> {
    const item = await this.opts.store.getByGenerationId(generationId);
    if (!item) throw new Error("Review item not found.");
    if (item.state !== "claimed") throw new Error(`Item not claimed — state=${item.state}`);
    if (item.claimedByReviewerId !== reviewerId) throw new Error("Not your claim.");
    if (item.claimExpiresAt && Date.parse(item.claimExpiresAt) < Date.now()) {
      throw new Error("Claim expired — re-claim first.");
    }
    return item;
  }

  private defaultPriority(tier: CustomerTier, triggers: string[]): 1 | 2 | 3 | 4 | 5 {
    const hi = triggers.some((t) => t.startsWith("phishing.") || t.startsWith("brand_imp") || t.startsWith("payment_fraud"));
    if (hi) return 1;
    if (tier === "scale" || tier === "agency") return 2;
    if (tier === "growth") return 3;
    if (tier === "starter") return 4;
    return 5;
  }
}

// â”€â”€ Reference in-memory stores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export class InMemoryReviewQueueStore implements ReviewQueueStore {
  private readonly byId = new Map<string, ReviewItem>();
  private readonly byGen = new Map<string, string>();

  async put(item: ReviewItem): Promise<void> {
    this.byId.set(item.id, item);
    this.byGen.set(item.generationId, item.id);
  }
  async get(id: string): Promise<ReviewItem | null> {
    return this.byId.get(id) ?? null;
  }
  async getByGenerationId(generationId: string): Promise<ReviewItem | null> {
    const id = this.byGen.get(generationId);
    return id ? this.byId.get(id) ?? null : null;
  }
  async listByState(state: ReviewState, limit = 50): Promise<ReviewItem[]> {
    const out: ReviewItem[] = [];
    for (const item of this.byId.values()) if (item.state === state) out.push(item);
    return out.slice(0, limit);
  }
  async update(id: string, patch: Partial<ReviewItem>): Promise<ReviewItem> {
    const cur = this.byId.get(id);
    if (!cur) throw new Error("Not found");
    const next = { ...cur, ...patch };
    this.byId.set(id, next);
    return next;
  }
}

export class InMemoryAppealStore implements AppealStore {
  private readonly byGen = new Map<string, AppealRecord>();
  async filed(appeal: AppealRecord): Promise<void> {
    this.byGen.set(appeal.generationId, appeal);
  }
  async get(generationId: string): Promise<AppealRecord | null> {
    return this.byGen.get(generationId) ?? null;
  }
  async decide(
    generationId: string,
    outcome: "appeal_granted" | "appeal_denied",
    reviewerId: string,
    notes: string,
  ): Promise<void> {
    const cur = this.byGen.get(generationId);
    if (!cur) throw new Error("appeal not found");
    cur.outcome = outcome;
    cur.decidedByReviewerId = reviewerId;
    cur.decidedAt = new Date().toISOString();
    cur.decisionNotes = notes;
  }
}
