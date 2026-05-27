/**
 * Capstone-as-Service.
 *
 * Spec: a student is matched with a local business that opted into the pool;
 * the student generates a funnel using GoFunnelAI, runs the engagement for 90
 * days under mentor oversight, and at graduation:
 *   - the student earns Strategist-eligible credit
 *   - the business converts to a paying GoFunnelAI customer
 *
 * This module owns the matching, lifecycle, and outcome measurement.
 *
 * Matching priorities (in order):
 *   1. Same vertical as the student's specialization
 *   2. Same country/region (TCPA + ad-policy alignment)
 *   3. Revenue band â‰¤ student's training level (lower-revenue = forgiving)
 *   4. Oldest opted-in business in the pool (FIFO fairness)
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  CAPSTONE_STATUSES,
  type Capstone,
  type CapstoneBusinessProfile,
  type CapstoneStatus,
  type IndustryVertical,
} from "./types.js";

export interface CapstoneStore {
  insertCapstone(capstone: Capstone): Promise<void>;
  getCapstone(id: string): Promise<Capstone | null>;
  updateCapstone(id: string, patch: Partial<Capstone>): Promise<Capstone>;
  /** Pool â€” unmatched businesses sorted by opted_in_at ASC. */
  listAvailableBusinesses(filter: {
    vertical?: IndustryVertical;
    region?: string;
    country?: string;
  }): Promise<CapstoneBusinessProfile[]>;
  markBusinessMatched(workspaceId: string, capstoneId: string): Promise<void>;
  markBusinessAvailable(workspaceId: string): Promise<void>;
  insertBusinessProfile(profile: CapstoneBusinessProfile): Promise<void>;
}

/* ===== Pool intake ===================================================== */

const OptInSchema = z.object({
  workspace_id: z.string().min(1),
  vertical: z.string().min(1),
  city: z.string(),
  region: z.string(),
  country: z.string(),
  revenue_band: z.enum(["<10k", "10k-50k", "50k-200k", "200k+"]),
});
export type CapstoneOptIn = z.infer<typeof OptInSchema>;

export async function optBusinessIntoPool(
  input: CapstoneOptIn,
  store: CapstoneStore,
  now: () => string = isoNow,
): Promise<CapstoneBusinessProfile> {
  const parsed = OptInSchema.parse(input);
  const profile: CapstoneBusinessProfile = {
    workspace_id: parsed.workspace_id,
    vertical: parsed.vertical as IndustryVertical,
    city: parsed.city,
    region: parsed.region,
    country: parsed.country,
    revenue_band: parsed.revenue_band,
    opted_in_at: now(),
    matched_capstone_id: null,
  };
  await store.insertBusinessProfile(profile);
  return profile;
}

/* ===== Create + match ================================================== */

const CreateCapstoneInputSchema = z.object({
  enrollment_id: z.string().min(1),
  user_id: z.string().min(1),
  course_id: z.string().min(1),
  /** Filter the pool to this student's specialization. */
  preferred_vertical: z.string().optional(),
  preferred_country: z.string().optional(),
  preferred_region: z.string().optional(),
  mentor_user_id: z.string().optional(),
});
export type CreateCapstoneInput = z.infer<typeof CreateCapstoneInputSchema>;

/**
 * Create a capstone engagement. Attempts to match a business immediately; if
 * none available, the capstone enters `matching` state and the matching job
 * retries nightly until a business arrives.
 */
export async function createCapstone(
  input: CreateCapstoneInput,
  store: CapstoneStore,
  now: () => Date = () => new Date(),
): Promise<Capstone> {
  const parsed = CreateCapstoneInputSchema.parse(input);
  const ts = now().toISOString();

  // Try an immediate match.
  const candidates = await store.listAvailableBusinesses({
    vertical: parsed.preferred_vertical as IndustryVertical | undefined,
    country: parsed.preferred_country,
    region: parsed.preferred_region,
  });
  const matched = candidates[0]; // pool is sorted FIFO by opted_in_at ASC

  const capstoneId = `cap_${ulid()}`;
  const capstone: Capstone = {
    id: capstoneId,
    enrollment_id: parsed.enrollment_id,
    user_id: parsed.user_id,
    course_id: parsed.course_id,
    business_workspace_id: matched?.workspace_id ?? null,
    status: matched ? "matched" : "matching",
    kickoff_at: null,
    graduation_due_at: null,
    mentor_user_id: parsed.mentor_user_id ?? null,
    outcomes: {
      leads_captured: 0,
      revtry_calls_completed: 0,
      booked_appointments: 0,
      revenue_attributed_cents: 0,
    },
    mentor_review_passed: null,
    business_converted_to_customer: false,
    created_at: ts,
    updated_at: ts,
  };
  await store.insertCapstone(capstone);
  if (matched) {
    await store.markBusinessMatched(matched.workspace_id, capstoneId);
  }
  return capstone;
}

/** Kick off the 90-day clock. Called when both sides confirm in-product. */
export async function kickoffCapstone(
  id: string,
  store: CapstoneStore,
  now: () => Date = () => new Date(),
): Promise<Capstone> {
  const cap = await store.getCapstone(id);
  if (!cap) throw new Error(`Capstone ${id} not found`);
  if (cap.status !== "matched") {
    throw new Error(`kickoffCapstone: capstone ${id} not in 'matched' state (was '${cap.status}')`);
  }
  const start = now();
  const due = new Date(start);
  due.setUTCDate(due.getUTCDate() + 90);
  return store.updateCapstone(id, {
    status: "in_flight",
    kickoff_at: start.toISOString(),
    graduation_due_at: due.toISOString(),
    updated_at: start.toISOString(),
  });
}

/* ===== Outcomes + graduation =========================================== */

const OutcomePatchSchema = z.object({
  leads_captured: z.number().int().nonnegative().optional(),
  revtry_calls_completed: z.number().int().nonnegative().optional(),
  booked_appointments: z.number().int().nonnegative().optional(),
  revenue_attributed_cents: z.number().int().nonnegative().optional(),
});

/** Idempotent set â€” caller passes the latest measured values, we overwrite. */
export async function updateCapstoneOutcomes(
  id: string,
  patch: z.infer<typeof OutcomePatchSchema>,
  store: CapstoneStore,
  now: () => string = isoNow,
): Promise<Capstone> {
  const parsed = OutcomePatchSchema.parse(patch);
  const cap = await store.getCapstone(id);
  if (!cap) throw new Error(`Capstone ${id} not found`);
  return store.updateCapstone(id, {
    outcomes: {
      ...cap.outcomes,
      ...parsed,
    },
    updated_at: now(),
  });
}

/**
 * Record the mentor's review. Passing review is required for Strategist
 * eligibility (checked in certifications.ts).
 */
export async function recordMentorReview(args: {
  capstone_id: string;
  passed: boolean;
  business_converted_to_customer: boolean;
}, store: CapstoneStore, now: () => string = isoNow): Promise<Capstone> {
  const cap = await store.getCapstone(args.capstone_id);
  if (!cap) throw new Error(`Capstone ${args.capstone_id} not found`);
  const status: CapstoneStatus = args.passed ? "graduated" : cap.status;
  return store.updateCapstone(args.capstone_id, {
    mentor_review_passed: args.passed,
    business_converted_to_customer: args.business_converted_to_customer,
    status,
    updated_at: now(),
  });
}

export async function abandonCapstone(
  id: string,
  reason: string,
  store: CapstoneStore,
  now: () => string = isoNow,
): Promise<Capstone> {
  const cap = await store.getCapstone(id);
  if (!cap) throw new Error(`Capstone ${id} not found`);
  // Return the business to the pool so another student can match it.
  if (cap.business_workspace_id) {
    await store.markBusinessAvailable(cap.business_workspace_id);
  }
  return store.updateCapstone(id, {
    status: "abandoned",
    updated_at: now(),
  });
}

export function isCapstoneStatus(v: string): v is CapstoneStatus {
  return (CAPSTONE_STATUSES as readonly string[]).includes(v);
}

function isoNow(): string {
  return new Date().toISOString();
}
