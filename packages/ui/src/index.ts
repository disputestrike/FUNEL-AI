/**
 * `@funnel/ui` — root barrel.
 *
 * Re-exports:
 *  - shadcn-style primitives (Button, Dialog, etc.)
 *  - the 60-block funnel library
 *  - the FunnelPreviewRenderer + BlockRegistry + edit affordances
 *  - shared helpers (`cn`)
 */

export * from "./lib/cn";
export * from "./primitives";
export * from "./funnel-blocks";
export * from "./funnel-renderer";
