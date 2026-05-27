/**
 * Ambient module shims for the @funnel/* packages we dynamically import.
 *
 * We use `await import("@funnel/xxx")` everywhere so that the workers service
 * can boot even if some peer packages are mid-rewrite or have build issues.
 * TypeScript can't always resolve those imports statically because some of
 * the packages don't yet emit `.d.ts` files. The shims below let `tsc` accept
 * the imports; each worker locally narrows the unknown to its own interface
 * before calling.
 */

declare module "@funnel/orchestrator" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/notifications" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/revtry" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/activation" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/crm" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/kb" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/compliance" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/integrations" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/billing" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/email" {
  const mod: Record<string, unknown>;
  export = mod;
}
declare module "@funnel/db" {
  export const prisma: {
    [k: string]: unknown;
    $queryRaw: (s: TemplateStringsArray, ...args: unknown[]) => Promise<unknown>;
    $disconnect(): Promise<void>;
  };
  export function runRestoreDrill(): Promise<{
    drill_id: string;
    rpo_seconds: number;
    rto_seconds: number;
    backup_id: string;
    smoke_passed: boolean;
    issues: string[];
  }>;
}
declare module "@funnel/events" {
  import type { z } from "zod";
  export const EventSchemas: Record<string, z.ZodTypeAny>;
  export function emit(name: string, payload: unknown): Promise<void>;
  export type EventName = string;
  export type EventPayload<N extends string> = unknown;
}
