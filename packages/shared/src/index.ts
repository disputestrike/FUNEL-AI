/**
 * `@funnel/shared` — root barrel.
 *
 * Re-exports every public surface in the package. Importers can also reach
 * into named subpath exports (`@funnel/shared/types`, `@funnel/shared/utils`,
 * `@funnel/shared/funnel-schema`, etc.) — see `package.json#exports`.
 */

export * from "./types/index.js";
export * from "./constants/index.js";
export * from "./schemas/index.js";
export * from "./funnel-schema.js";
export * from "./utils/index.js";
export * from "./errors.js";
// Launch Center surface is intentionally NOT spread at the package root to
// avoid name collisions with existing compliance types (`ComplianceSeverity`).
// Import from the named subpath instead: `@funnel/shared/launch`.
