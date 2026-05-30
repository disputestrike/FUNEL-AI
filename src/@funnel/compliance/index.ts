/**
 * @funnel/compliance — public exports.
 *
 * Layout:
 *  - regulated-verticals: canonical list of regulated industries.
 *  - rules-library: per-vertical prohibited claims, disclosures, geo overlays.
 *  - agent-runner: orchestrates fact-check + compliance LLM agents.
 *  - audit: append-only audit log with HMAC chain.
 *  - disclosure: AI disclosure rendering (page / voice / sms / email / ad).
 *  - consent-sdk: capture + revoke + delete-my-data flow.
 *  - publish-acknowledgment: 05e regulated-vertical publish-time gate.
 *  - human-review-queue: 07b operational queue + appeals.
 *  - data-residency: region pinning + enforcement.
 *  - breach-notification: GDPR 72-hr breach workflow.
 *  - incident-response: 24/7 on-call SLA management.
 *  - bias-audit: quarterly LLM-as-judge bias audit.
 *  - redteam: monthly red-team regression suite.
 */

export * from "./regulated-verticals.js";
export * from "./rules-library.js";
export * from "./agent-runner.js";
export * from "./audit.js";
export * from "./disclosure.js";
export * from "./consent-sdk.js";
export * from "./publish-acknowledgment.js";
export * from "./human-review-queue.js";
export * from "./data-residency.js";
export * from "./breach-notification.js";
export * from "./incident-response.js";
export * from "./bias-audit.js";
export * from "./redteam.js";
export * from "./types.js";
