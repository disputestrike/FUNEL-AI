/**
 * @funnel/marketplace — public surface.
 *
 * Re-exports the publishing flow, purchase + clone flow, reviews, fraud,
 * payouts, and SEO helpers. Stripe/PayPal adapters are exported separately
 * so consumers can import them only when they need the prod implementation.
 */

export * from "./types.js";
export * from "./port.js";

export {
  publishTemplate,
  updateTemplate,
  getTemplate,
  listTemplates,
  unpublishTemplate,
  BRONZE_THRESHOLD_USD_CENTS,
  BRONZE_MIN_UNIQUE_CUSTOMERS,
  BRONZE_MIN_DAYS_SINCE_PUBLISH,
} from "./templates.js";

export {
  purchaseTemplate,
  handleStripeWebhook,
  refundPurchase,
  computeShares,
  STRIPE_FEE_BPS,
  STRIPE_FEE_FIXED_USD_CENTS,
  CREATOR_SHARE_BPS,
  REFUND_WINDOW_DAYS,
} from "./purchases.js";

export { cloneTemplate } from "./clone.js";

export {
  submitReview,
  flagReview,
  replyToReview,
  moderateReview,
  MIN_DAYS_BEFORE_REVIEW,
} from "./reviews.js";

export {
  upsertPayoutAccount,
  buildPayoutForCreator,
  executePayout,
  runMonthlyPayoutBatch,
  aggregateForPayout,
  needsTaxForm,
  defaultPayoutMethodForCountry,
  MIN_PAYOUT_USD_CENTS,
  TAX_FORM_THRESHOLD_USD_CENTS,
} from "./payouts.js";

export { detectSelfPurchaseFraud, detectReviewCluster } from "./fraud.js";
export { profanityScore } from "./moderation.js";

export { generateSlug, renderTemplateSeo, renderSitemapFragment } from "./seo.js";
export type { MarketplaceSeoBlob } from "./seo.js";

export { runAutomatedChecks } from "./qa.js";
export type { QaCheckInput, QaCheckResult } from "./qa.js";

export { createStripeAdapter } from "./adapters/stripe.js";
export type { StripeAdapterConfig } from "./adapters/stripe.js";
export { createPayPalAdapter } from "./adapters/paypal.js";
export type { PayPalAdapterConfig } from "./adapters/paypal.js";
