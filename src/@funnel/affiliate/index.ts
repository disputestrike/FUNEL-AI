/**
 * `@funnel/affiliate` — public surface.
 *
 * See docs/16-viral-loops-spec.md §LOOP 2 for the program rules; this module
 * implements the data model + the four operational subsystems:
 *
 *   1. Enrollment (auto-approved)
 *   2. Short links + tracking (90-day first-click cookie)
 *   3. Commission ledger (40% recurring lifetime + 40% voice overage)
 *   4. Payouts (weekly PayPal Mass Pay, $50 minimum)
 *
 * Plus: Dream Car snapshot, public leaderboard, fraud detection, dashboard.
 */

export * from "./types.js";
export * from "./constants.js";
export * from "./store.js";
export * from "./enroll.js";
export * from "./links.js";
export * from "./tracking.js";
export * from "./commissions.js";
export * from "./payouts.js";
export * from "./dream-car.js";
export * from "./leaderboard.js";
export * from "./fraud-detection.js";
export * from "./dashboard.js";
