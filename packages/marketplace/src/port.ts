/**
 * Data-access port for `@funnel/marketplace`.
 *
 * The marketplace package does not import `@prisma/client` directly. Instead,
 * callers pass a small typed `MarketplaceDb` interface satisfied by either:
 *   - the real Prisma client (wired in apps/api), or
 *   - an in-memory implementation (used in tests/inMemoryDb.ts).
 *
 * Keeping the port narrow lets us swap storage engines and keeps unit tests
 * fast — no Postgres needed.
 */

import type {
  CreatorPayout,
  CreatorPayoutAccount,
  FraudFlag,
  Purchase,
  Review,
  Template,
  TemplateStatus,
  TemplateVersion,
} from "./types.js";

export interface FunnelStub {
  id: string;
  workspace_id: string;
  created_by: string;
  /** Total revenue captured through this funnel, in USD cents. */
  lifetime_revenue_usd_cents: number;
  /** Live + days-since-publish requirement for anti-gaming. */
  published_at: string | null;
  /** Unique paying customers — anti-gaming for Bronze gate. */
  unique_customer_count: number;
  /** Funnel JSON snapshot used for cloning. */
  funnel_blob: unknown;
  email_sequences_blob: unknown;
  sms_sequences_blob: unknown;
  voice_script_blob: unknown;
  ad_creative_blob: unknown;
  kb_pack_ref: string | null;
}

export interface MarketplaceDb {
  /* Funnels (read-only for marketplace gating + cloning) */
  getFunnel(funnel_id: string): Promise<FunnelStub | null>;
  cloneFunnelInto(args: {
    source_funnel: FunnelStub;
    buyer_workspace_id: string;
    template_parent_id: string;
    template_version_id: string;
  }): Promise<{ new_funnel_id: string }>;

  /* Templates */
  insertTemplate(t: Template): Promise<Template>;
  updateTemplate(template_id: string, patch: Partial<Template>): Promise<Template>;
  getTemplate(template_id: string): Promise<Template | null>;
  getTemplateBySlug(slug: string): Promise<Template | null>;
  listTemplates(args: {
    where: Partial<{
      category: string;
      status: TemplateStatus;
      creator_id: string;
      free_only: boolean;
      min_rating: number;
      min_price_cents: number;
      max_price_cents: number;
      search: string;
    }>;
    orderBy: "popularity" | "rating" | "recent" | "price_asc" | "price_desc";
    cursor: string | null;
    limit: number;
  }): Promise<{ rows: Template[]; next_cursor: string | null }>;

  /* Versions */
  insertTemplateVersion(v: TemplateVersion): Promise<TemplateVersion>;
  getTemplateVersion(version_id: string): Promise<TemplateVersion | null>;
  latestPublishedVersion(template_id: string): Promise<TemplateVersion | null>;

  /* Purchases */
  insertPurchase(p: Purchase): Promise<Purchase>;
  updatePurchase(id: string, patch: Partial<Purchase>): Promise<Purchase>;
  getPurchase(id: string): Promise<Purchase | null>;
  getPurchaseByCheckoutSession(session_id: string): Promise<Purchase | null>;
  hasPaidPurchase(template_id: string, buyer_workspace_id: string): Promise<Purchase | null>;
  listPurchasesForCreator(creator_id: string, period_start: string, period_end: string): Promise<Purchase[]>;

  /* Reviews */
  insertReview(r: Review): Promise<Review>;
  updateReview(id: string, patch: Partial<Review>): Promise<Review>;
  getReview(id: string): Promise<Review | null>;
  getReviewByPurchase(purchase_id: string): Promise<Review | null>;
  listReviewsForTemplate(template_id: string, limit: number, cursor: string | null): Promise<{
    rows: Review[];
    next_cursor: string | null;
  }>;
  recomputeTemplateRating(template_id: string): Promise<{ avg: number; count: number }>;

  /* Payout account + payouts */
  upsertPayoutAccount(a: CreatorPayoutAccount): Promise<CreatorPayoutAccount>;
  getPayoutAccount(creator_id: string): Promise<CreatorPayoutAccount | null>;
  incrementPayoutLifetime(creator_id: string, delta_cents: number): Promise<CreatorPayoutAccount>;
  insertPayout(p: CreatorPayout): Promise<CreatorPayout>;
  updatePayout(id: string, patch: Partial<CreatorPayout>): Promise<CreatorPayout>;

  /* Fraud */
  insertFraudFlag(f: FraudFlag): Promise<FraudFlag>;
  listOpenFraudFlags(subject_type: FraudFlag["subject_type"], subject_id: string): Promise<FraudFlag[]>;
  resolveFraudFlag(id: string, resolved_at: string): Promise<FraudFlag>;

  /* Telemetry — IP / device fingerprint cluster checks */
  countReviewsFromSameNetworkAsCreator(
    template_id: string,
    creator_id: string,
    last_minutes: number,
  ): Promise<number>;
}

/**
 * Stripe port — abstracted to make the package testable without hitting Stripe.
 * Adapters live in `src/adapters/stripe.ts`.
 */
export interface StripePort {
  createCheckoutSession(args: {
    template_id: string;
    buyer_workspace_id: string;
    buyer_user_id: string;
    creator_id: string;
    price_usd_cents: number;
    success_url: string;
    cancel_url: string;
    metadata: Record<string, string>;
  }): Promise<{ session_id: string; checkout_url: string }>;

  retrieveSessionFromWebhook(rawBody: string, signature: string): Promise<{
    session_id: string;
    payment_intent_id: string;
    charge_id: string | null;
    amount_total_usd_cents: number;
    application_fee_amount_usd_cents: number;
    metadata: Record<string, string>;
    livemode: boolean;
  }>;

  refundCharge(args: {
    charge_id: string;
    amount_usd_cents: number;
    reason: string;
  }): Promise<{ refund_id: string }>;

  // Connect / payouts
  payoutToConnectedAccount(args: {
    connect_account_id: string;
    amount_usd_cents: number;
    description: string;
    idempotency_key: string;
  }): Promise<{ transfer_id: string }>;
}

/**
 * PayPal port for non-US creators who pick PayPal Payouts.
 */
export interface PayPalPort {
  sendPayout(args: {
    payout_email: string;
    amount_usd_cents: number;
    description: string;
    idempotency_key: string;
  }): Promise<{ payout_batch_id: string }>;
}
