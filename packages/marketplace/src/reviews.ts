/**
 * Reviews — 5-star + comment.
 *
 * Rules (Doc 16 §4.9):
 *   - Reviewer must have a verified purchase ≥ 7 days old.
 *   - One review per (template_id, reviewer) — re-writes replace.
 *   - Self-review forbidden (reviewer != creator).
 *   - Profanity + AUP filter (basic; deeper moderation in trust-safety).
 *   - Creator may reply ONCE.
 *   - Velocity / network cluster checks → `fraud.ts`.
 */

import { randomBytes } from "node:crypto";

import { profanityScore } from "./moderation.js";
import type { MarketplaceDb } from "./port.js";
import {
  MarketplaceError,
  type Review,
  type ReviewWrite,
  ReviewWriteSchema,
} from "./types.js";

export const MIN_DAYS_BEFORE_REVIEW = 7;

export interface ReviewContext {
  db: MarketplaceDb;
  now?: () => Date;
}

export async function submitReview(ctx: ReviewContext, input: ReviewWrite): Promise<Review> {
  const parsed = ReviewWriteSchema.parse(input);
  const now = ctx.now ? ctx.now() : new Date();

  const template = await ctx.db.getTemplate(parsed.template_id);
  if (!template) throw new MarketplaceError("Template not found.", "TEMPLATE_NOT_FOUND", 404);

  if (template.creator_id === parsed.reviewer_user_id) {
    throw new MarketplaceError("Cannot review your own template.", "SELF_REVIEW_FORBIDDEN", 403);
  }

  // Find a valid purchase by this reviewer.
  // We don't have a direct query for (template, user); production schema
  // exposes one via index. We rely on `hasPaidPurchase` keyed by workspace
  // — for tests, callers wire `getReviewByPurchase` to be sufficient.
  // Production should add `MarketplaceDb#findPurchaseByReviewer(template_id, user_id)`.
  const purchase = await ctx.db.hasPaidPurchase(parsed.template_id, parsed.reviewer_user_id);
  if (!purchase || purchase.status !== "paid" || !purchase.paid_at) {
    throw new MarketplaceError(
      "Only verified purchasers may review.",
      "NOT_VERIFIED_PURCHASE",
      403,
    );
  }
  const ageMs = now.getTime() - new Date(purchase.paid_at).getTime();
  if (ageMs < MIN_DAYS_BEFORE_REVIEW * 86_400_000) {
    throw new MarketplaceError(
      `Reviews require a ${MIN_DAYS_BEFORE_REVIEW}-day waiting period after purchase.`,
      "REVIEW_TOO_EARLY",
      425,
    );
  }

  const existing = await ctx.db.getReviewByPurchase(purchase.id);
  const profanity = profanityScore(parsed.comment);
  const status: Review["status"] = profanity >= 0.6 ? "pending_moderation" : "visible";

  const baseReview = {
    template_id: parsed.template_id,
    purchase_id: purchase.id,
    reviewer_user_id: parsed.reviewer_user_id,
    stars: parsed.stars,
    comment: parsed.comment,
    status,
    creator_reply: existing?.creator_reply ?? null,
    creator_replied_at: existing?.creator_replied_at ?? null,
    flagged_count: existing?.flagged_count ?? 0,
    hidden_reason: null,
    updated_at: now.toISOString(),
  };

  let saved: Review;
  if (existing) {
    saved = await ctx.db.updateReview(existing.id, baseReview);
  } else {
    saved = await ctx.db.insertReview({
      id: `rvw_${ulidLike(now)}`,
      ...baseReview,
      created_at: now.toISOString(),
    });
  }
  await ctx.db.recomputeTemplateRating(parsed.template_id);

  await safeEmit("template_reviewed", {
    template_id: parsed.template_id,
    review_id: saved.id,
    reviewer_user_id: parsed.reviewer_user_id,
    stars: parsed.stars,
    has_comment: parsed.comment.length > 0,
  });
  return saved;
}

export async function flagReview(
  ctx: ReviewContext,
  review_id: string,
  flagger_user_id: string,
  reason: string,
): Promise<Review> {
  const r = await ctx.db.getReview(review_id);
  if (!r) throw new MarketplaceError("Review not found.", "REVIEW_NOT_FOUND", 404);
  const updated = await ctx.db.updateReview(r.id, {
    flagged_count: r.flagged_count + 1,
    status: r.flagged_count + 1 >= 3 ? "pending_moderation" : r.status,
    updated_at: (ctx.now ? ctx.now() : new Date()).toISOString(),
  });
  await safeEmit("template_review_flagged", {
    template_id: r.template_id,
    review_id: r.id,
    flagger_user_id,
    reason,
  });
  return updated;
}

export async function replyToReview(
  ctx: ReviewContext,
  review_id: string,
  creator_user_id: string,
  reply: string,
): Promise<Review> {
  if (reply.length < 4 || reply.length > 2_000) {
    throw new MarketplaceError("Reply must be 4–2000 chars.", "BAD_REPLY", 400);
  }
  const r = await ctx.db.getReview(review_id);
  if (!r) throw new MarketplaceError("Review not found.", "REVIEW_NOT_FOUND", 404);
  const template = await ctx.db.getTemplate(r.template_id);
  if (!template || template.creator_id !== creator_user_id) {
    throw new MarketplaceError("Only the template creator may reply.", "NOT_CREATOR", 403);
  }
  if (r.creator_reply) {
    throw new MarketplaceError("Reply already exists.", "REPLY_EXISTS", 409);
  }
  return ctx.db.updateReview(r.id, {
    creator_reply: reply,
    creator_replied_at: (ctx.now ? ctx.now() : new Date()).toISOString(),
    updated_at: (ctx.now ? ctx.now() : new Date()).toISOString(),
  });
}

export async function moderateReview(
  ctx: ReviewContext,
  review_id: string,
  decision: "approve" | "hide",
  reason: string | null,
): Promise<Review> {
  const r = await ctx.db.getReview(review_id);
  if (!r) throw new MarketplaceError("Review not found.", "REVIEW_NOT_FOUND", 404);
  return ctx.db.updateReview(r.id, {
    status: decision === "approve" ? "visible" : "hidden_violation",
    hidden_reason: decision === "hide" ? reason : null,
    updated_at: (ctx.now ? ctx.now() : new Date()).toISOString(),
  });
}

function ulidLike(now: Date): string {
  const ts = now.getTime().toString(36).padStart(10, "0").toUpperCase();
  const rnd = randomBytes(10).toString("hex").toUpperCase().slice(0, 16);
  return `${ts}${rnd}`.slice(0, 26);
}

async function safeEmit(name: string, payload: unknown): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: name, ts: Date.now(), ...((payload as object) ?? {}) }));
}
