/**
 * `@funnel/shared/launch` — Level 2 Launch Center barrel.
 *
 * Brand: GoFunnelAI (gofunnelai.com).
 *
 * Re-exports every public surface in the launch subsystem so consumers can do:
 *
 *   import {
 *     CampaignStatus,
 *     canTransition,
 *     emitTransition,
 *     computeLaunchReadinessScore,
 *     PLATFORM_META,
 *     AD_ANGLES,
 *   } from "@funnel/shared/launch";
 *
 * The granular files (`./types.ts`, `./schemas.ts`, `./lifecycle.ts`,
 * `./scores.ts`, `./platforms.ts`, `./angles.ts`) remain individually
 * importable for tree-shaking.
 */

export * from "./types.js";
export * from "./schemas.js";
export * from "./lifecycle.js";
export * from "./scores.js";
export * from "./platforms.js";
export * from "./angles.js";
