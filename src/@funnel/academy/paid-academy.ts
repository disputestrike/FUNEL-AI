/**
 * Paid Academy programs ($297 - $1,997).
 *
 * Two flavors:
 *   - **Industry Mastery** — one program per top vertical (HVAC, med-spa, etc.)
 *   - **Agency Mastery** — wraps the doc-13 §3 cert course in a cohort
 *
 * Refund policy alignment (Doc 05d):
 *   - Default 14-day refund window from purchase.
 *   - Refund is forfeited once the student has completed > `refund_forfeit_after_lessons`
 *     lessons (we ship 3 as the default).
 *   - Refund is forfeited once the cohort has had its first live session for
 *     cohort-delivered programs.
 *
 * Payment processor strategy (Doc 04):
 *   - PayPal is primary (international + buyer trust).
 *   - Stripe is the fallback for cards where PayPal isn't available.
 *   - We never store raw card data; the processor returns a token.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  type Cohort,
  type Course,
  type Enrollment,
  type PaidProgram,
} from "./types.js";

export interface PaidAcademyStore {
  insertProgram(program: PaidProgram): Promise<void>;
  getProgram(id: string): Promise<PaidProgram | null>;
  listPrograms(filter: { active?: boolean }): Promise<PaidProgram[]>;
  updateProgram(id: string, patch: Partial<PaidProgram>): Promise<PaidProgram>;

  insertEnrollment(e: Enrollment): Promise<void>;
  getEnrollment(id: string): Promise<Enrollment | null>;
  updateEnrollment(id: string, patch: Partial<Enrollment>): Promise<Enrollment>;
  countCompletedLessonsForEnrollment(enrollmentId: string): Promise<number>;

  getCohort(id: string): Promise<Cohort | null>;
}

/**
 * The billing-side interface we depend on. In production this is implemented
 * by `@funnel/billing`; here we depend on the contract only so the package
 * builds standalone (and the test harness can stub it).
 */
export interface BillingAdapter {
  createCheckoutSession(args: {
    user_id: string;
    program_id: string;
    success_url: string;
    cancel_url: string;
    /** "paypal" (primary) or "stripe" (fallback). */
    processor: "paypal" | "stripe";
  }): Promise<{ checkout_url: string; checkout_id: string }>;

  refund(args: {
    invoice_id: string;
    amount_cents: number;
    reason: string;
  }): Promise<{ refund_id: string; refunded_at: string }>;
}

/* ===== Create / list programs ========================================= */

const ProgramInputSchema = z.object({
  course_id: z.string().min(1),
  name: z.string().min(1).max(160),
  price_cents: z
    .number()
    .int()
    // Spec window: $297 - $1,997.
    .min(29700, "minimum paid-academy price is $297")
    .max(199700, "maximum paid-academy price is $1,997"),
  delivery: z.enum(["cohort", "self_paced"]),
  refund_window_days: z.number().int().min(0).default(14),
  refund_forfeit_after_lessons: z.number().int().min(0).default(3),
  stripe_price_id: z.string().min(1),
  paypal_plan_id: z.string().min(1).nullable().optional(),
});
export type ProgramInput = z.infer<typeof ProgramInputSchema>;

export async function createProgram(
  input: ProgramInput,
  store: PaidAcademyStore,
): Promise<PaidProgram> {
  const parsed = ProgramInputSchema.parse(input);
  const program: PaidProgram = {
    id: `prog_${ulid()}`,
    course_id: parsed.course_id,
    name: parsed.name,
    price_cents: parsed.price_cents,
    delivery: parsed.delivery,
    refund_window_days: parsed.refund_window_days,
    refund_forfeit_after_lessons: parsed.refund_forfeit_after_lessons,
    stripe_price_id: parsed.stripe_price_id,
    paypal_plan_id: parsed.paypal_plan_id ?? null,
    active: true,
  };
  await store.insertProgram(program);
  return program;
}

export async function listPrograms(
  store: PaidAcademyStore,
  filter: { active?: boolean } = { active: true },
): Promise<PaidProgram[]> {
  return store.listPrograms(filter);
}

/* ===== Checkout ======================================================== */

const CheckoutInputSchema = z.object({
  user_id: z.string().min(1),
  program_id: z.string().min(1),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  /**
   * Caller-chosen processor. Defaults to PayPal per Doc 04. If the user's
   * country has no PayPal availability the caller should pass "stripe".
   */
  processor: z.enum(["paypal", "stripe"]).default("paypal"),
});
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export async function createCheckout(
  input: CheckoutInput,
  store: PaidAcademyStore,
  billing: BillingAdapter,
): Promise<{ checkout_url: string; checkout_id: string }> {
  const parsed = CheckoutInputSchema.parse(input);
  const program = await store.getProgram(parsed.program_id);
  if (!program) throw new Error(`Program ${parsed.program_id} not found`);
  if (!program.active) throw new Error(`Program ${parsed.program_id} is inactive`);
  if (parsed.processor === "paypal" && !program.paypal_plan_id) {
    throw new Error(`Program ${parsed.program_id} has no PayPal plan; pass processor=stripe`);
  }
  return billing.createCheckoutSession({
    user_id: parsed.user_id,
    program_id: parsed.program_id,
    success_url: parsed.success_url,
    cancel_url: parsed.cancel_url,
    processor: parsed.processor,
  });
}

/* ===== Enrollment on paid success ===================================== */

export async function fulfillPaidEnrollment(args: {
  user_id: string;
  program_id: string;
  invoice_id: string;
  /** For cohort-delivered programs, the cohort the student is joining. */
  cohort_id?: string;
}, store: PaidAcademyStore, now: () => string = isoNow): Promise<Enrollment> {
  const program = await store.getProgram(args.program_id);
  if (!program) throw new Error(`Program ${args.program_id} not found`);
  if (program.delivery === "cohort" && !args.cohort_id) {
    throw new Error("Cohort program requires cohort_id");
  }
  if (args.cohort_id) {
    const cohort = await store.getCohort(args.cohort_id);
    if (!cohort) throw new Error(`Cohort ${args.cohort_id} not found`);
    if (cohort.status === "full") throw new Error(`Cohort ${args.cohort_id} is full`);
    if (cohort.status === "completed") {
      throw new Error(`Cohort ${args.cohort_id} has already completed`);
    }
  }
  const ts = now();
  const enrollment: Enrollment = {
    id: `enr_${ulid()}`,
    user_id: args.user_id,
    course_id: program.course_id,
    invoice_id: args.invoice_id,
    cohort_id: args.cohort_id ?? null,
    institution_id: null,
    status: "active",
    enrolled_at: ts,
    completed_at: null,
    refunded_at: null,
    progress_pct: 0,
    last_lesson_id: null,
  };
  await store.insertEnrollment(enrollment);
  return enrollment;
}

/* ===== Refunds (aligned to Doc 05d) ==================================== */

export interface RefundEligibility {
  refundable: boolean;
  reason:
    | "ok"
    | "outside_refund_window"
    | "too_many_lessons_completed"
    | "cohort_already_started"
    | "already_refunded";
}

export async function checkRefundEligibility(
  enrollmentId: string,
  store: PaidAcademyStore,
  now: () => Date = () => new Date(),
): Promise<RefundEligibility> {
  const e = await store.getEnrollment(enrollmentId);
  if (!e) throw new Error(`Enrollment ${enrollmentId} not found`);
  if (e.refunded_at) return { refundable: false, reason: "already_refunded" };

  // For cohort programs, refund window also closes after the first live session.
  if (e.cohort_id) {
    const cohort = await store.getCohort(e.cohort_id);
    if (cohort && new Date(cohort.starts_at) < now()) {
      return { refundable: false, reason: "cohort_already_started" };
    }
  }

  // Program-defined refund window.
  // We don't have `program` from the enrollment directly; recover via the
  // course-id is the responsibility of the caller in production. For this
  // module we look up the first matching program with the same course_id.
  const programs = await store.listPrograms({ active: true });
  const program = programs.find((p) => p.course_id === e.course_id);
  if (program) {
    const enrolledAt = new Date(e.enrolled_at);
    const cutoff = new Date(enrolledAt);
    cutoff.setUTCDate(cutoff.getUTCDate() + program.refund_window_days);
    if (now() > cutoff) {
      return { refundable: false, reason: "outside_refund_window" };
    }
    const completed = await store.countCompletedLessonsForEnrollment(enrollmentId);
    if (completed > program.refund_forfeit_after_lessons) {
      return { refundable: false, reason: "too_many_lessons_completed" };
    }
  }
  return { refundable: true, reason: "ok" };
}

export async function refundEnrollment(args: {
  enrollment_id: string;
  reason: string;
}, store: PaidAcademyStore, billing: BillingAdapter, now: () => string = isoNow): Promise<Enrollment> {
  const elig = await checkRefundEligibility(args.enrollment_id, store, () => new Date(now()));
  if (!elig.refundable) {
    throw new Error(`Refund denied: ${elig.reason}`);
  }
  const e = await store.getEnrollment(args.enrollment_id);
  if (!e) throw new Error(`Enrollment ${args.enrollment_id} not found`);
  if (!e.invoice_id) throw new Error(`Enrollment ${args.enrollment_id} has no invoice — free enrollment cannot be refunded`);

  const programs = await store.listPrograms({ active: true });
  const program = programs.find((p) => p.course_id === e.course_id);
  if (!program) throw new Error(`No program found for course ${e.course_id}`);

  await billing.refund({
    invoice_id: e.invoice_id,
    amount_cents: program.price_cents,
    reason: args.reason,
  });

  return store.updateEnrollment(args.enrollment_id, {
    status: "refunded",
    refunded_at: now(),
  });
}

function isoNow(): string {
  return new Date().toISOString();
}

export { ProgramInputSchema, CheckoutInputSchema };
