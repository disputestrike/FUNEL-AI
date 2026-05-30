/**
 * Anti-fraud for marketplace.
 *
 * Two main vectors:
 *   1. Self-purchase / sock-puppet purchase (creator buys their own template
 *      to boost sales rank or wash a review). Checks: same workspace, same
 *      user, shared device fingerprint, shared IP.
 *   2. Review manipulation (cluster of new accounts giving 5-stars from
 *      creator's network). Checks: shared IP / fingerprint, signup velocity.
 *
 * All detections are persisted as `FraudFlag` rows. `auto_action` may be
 * "block_purchase", "hide_review", or "queue_review_human".
 */

import { randomBytes } from "node:crypto";

import type { MarketplaceDb } from "./port.js";
import type { FraudFlag, Template } from "./types.js";

const REVIEW_VELOCITY_WINDOW_MIN = 24 * 60;
const REVIEW_VELOCITY_THRESHOLD = 10;

export interface SelfPurchaseCheckInput {
  template: Template;
  buyer_user_id: string;
  buyer_workspace_id: string;
  caller_fingerprint: string | null;
}

export interface SelfPurchaseCheckResult {
  blocked: boolean;
  reasons: string[];
  flag_id?: string;
}

export async function detectSelfPurchaseFraud(
  db: MarketplaceDb,
  input: SelfPurchaseCheckInput,
): Promise<SelfPurchaseCheckResult> {
  const reasons: string[] = [];
  if (input.template.creator_id === input.buyer_user_id) {
    reasons.push("buyer_is_creator");
  }
  if (input.template.creator_workspace_id === input.buyer_workspace_id) {
    reasons.push("buyer_workspace_is_creator_workspace");
  }
  // Production also checks shared fingerprint clusters via a separate
  // device-fingerprint service. We surface a hook here.
  if (input.caller_fingerprint) {
    // No-op locally; would call fingerprint cluster service.
  }
  if (reasons.length === 0) return { blocked: false, reasons };
  const flag = await persistFlag(db, {
    subject_type: "purchase",
    subject_id: `pending-${input.template.id}-${input.buyer_user_id}`,
    rule_id: "self_purchase",
    severity: "block",
    auto_action: "block_purchase",
    details: { reasons, template_id: input.template.id },
  });
  return { blocked: true, reasons, flag_id: flag.id };
}

export interface ReviewClusterCheckInput {
  template_id: string;
  creator_id: string;
}

/**
 * Look for a velocity/network cluster around a template's reviews.
 * Called on every new review (post-insert) — flags hide the review
 * pending human triage if a cluster is detected.
 */
export async function detectReviewCluster(
  db: MarketplaceDb,
  input: ReviewClusterCheckInput,
): Promise<{ flagged: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const networkCount = await db.countReviewsFromSameNetworkAsCreator(
    input.template_id,
    input.creator_id,
    REVIEW_VELOCITY_WINDOW_MIN,
  );
  if (networkCount >= REVIEW_VELOCITY_THRESHOLD) {
    reasons.push("review_cluster_velocity");
    await persistFlag(db, {
      subject_type: "template",
      subject_id: input.template_id,
      rule_id: "review_cluster_velocity",
      severity: "warn",
      auto_action: "queue_review_human",
      details: { network_count: networkCount, window_min: REVIEW_VELOCITY_WINDOW_MIN },
    });
  }
  return { flagged: reasons.length > 0, reasons };
}

/* ──────────────────────────────────────────────────────────────────────── */

async function persistFlag(
  db: MarketplaceDb,
  flag: Omit<FraudFlag, "id" | "created_at" | "resolved_at">,
): Promise<FraudFlag> {
  return db.insertFraudFlag({
    id: `frd_${ulidLike(new Date())}`,
    resolved_at: null,
    created_at: new Date().toISOString(),
    ...flag,
  });
}

function ulidLike(now: Date): string {
  const ts = now.getTime().toString(36).padStart(10, "0").toUpperCase();
  const rnd = randomBytes(10).toString("hex").toUpperCase().slice(0, 16);
  return `${ts}${rnd}`.slice(0, 26);
}
