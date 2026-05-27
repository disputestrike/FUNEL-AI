/**
 * Re-exports for `@funnel/shared/types`.
 *
 * Importers can do:
 *
 *   import type { Workspace, Lead, Funnel } from "@funnel/shared/types";
 *
 * The canonical type surface lives in the sibling files. This barrel keeps
 * downstream import sites short.
 */

export * from "./workspace.js";
export * from "./user.js";
export * from "./funnel.js";
export * from "./crm.js";
export * from "./billing.js";
export * from "./compliance.js";
export * from "./branding.js";
export * from "./persona.js";
export * from "./industry.js";
export * from "./generation.js";
export * from "./grader.js";
