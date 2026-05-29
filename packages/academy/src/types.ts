/**
 * @funnel/academy — types.
 *
 * Domain model for the GoFunnelAI Academy (the education arm).
 *
 * - Free + paid courses (Industry Mastery $297-$1,997)
 * - 3 certification ladders: Operator, Strategist, Agency Partner
 *   (Agency Partner = the cert course defined in docs/13-agency-enablement-kit.md Â§3)
 * - Capstone-as-service (student Ã— local-business pairing)
 * - College pipeline (LTI 1.3 — Canvas / Blackboard / Moodle)
 *
 * Every persisted entity uses ULID IDs with a typed prefix (Doc 03 conventions).
 *
 * IDs:
 *   crs_  course
 *   mod_  module
 *   les_  lesson
 *   qz_   quiz
 *   qa_   quiz_question
 *   pg_   progress row
 *   enr_  enrollment
 *   cert_ certification credential
 *   cap_  capstone engagement
 *   coh_  cohort
 *   inst_ institution (college / community college / HBCU)
 *   sub_  institution subscription
 *   prog_ paid program
 *   lp_   lesson playback session
 */

import { z } from "zod";

/* ===== Enums =========================================================== */

export const COURSE_TIERS = ["free", "paid"] as const;
export type CourseTier = (typeof COURSE_TIERS)[number];

export const COURSE_LEVELS = ["beginner", "intermediate", "advanced", "capstone"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const LESSON_TYPES = ["video", "text", "quiz", "exercise", "capstone"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const QUIZ_QUESTION_TYPES = [
  "multiple_choice",
  "multi_select",
  "true_false",
  "scenario",
  "code_fill_in",
  "short_answer",
] as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export const PROGRESS_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const CERT_KINDS = [
  "certified_operator", // basic
  "certified_strategist", // advanced
  "certified_agency_partner", // doc 13 cert
] as const;
export type CertKind = (typeof CERT_KINDS)[number];

export const CAPSTONE_STATUSES = [
  "matching", // waiting for a business
  "matched", // paired, awaiting kickoff
  "in_flight", // 90-day mentorship running
  "graduated", // both sides certified
  "abandoned", // either side dropped
] as const;
export type CapstoneStatus = (typeof CAPSTONE_STATUSES)[number];

export const ENROLLMENT_STATUSES = [
  "active",
  "completed",
  "refunded",
  "expired",
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const INSTITUTION_TYPES = [
  "hbcu",
  "community_college",
  "university",
  "high_school",
  "bootcamp",
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const LMS_KINDS = ["canvas", "blackboard", "moodle", "google_classroom"] as const;
export type LmsKind = (typeof LMS_KINDS)[number];

/** Day-1 launch verticals — match the KB packs (Doc 02a/02b, 13 Â§slide 8). */
export const INDUSTRY_VERTICALS = [
  "hvac",
  "plumbing",
  "roofing",
  "solar",
  "pest_control",
  "landscaping",
  "dental",
  "med_spa",
  "chiropractic",
  "physical_therapy",
  "mental_health",
  "vet",
  "law_pi",
  "law_family",
  "cpa",
  "financial_advisor",
  "insurance",
  "real_estate",
  "auto_repair",
  "auto_detail",
  "jeweler",
  "salon",
  "fitness",
  "gym",
  "restaurant",
  "catering",
  "event_venue",
  "photographer",
  "wedding_planner",
  "travel",
] as const;
export type IndustryVertical = (typeof INDUSTRY_VERTICALS)[number];

/* ===== Course / Module / Lesson ======================================== */

export const CourseMetaSchema = z.object({
  title: z.string().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  subtitle: z.string().max(280).optional(),
  description: z.string().max(4000),
  tier: z.enum(COURSE_TIERS),
  level: z.enum(COURSE_LEVELS),
  industry: z.enum(INDUSTRY_VERTICALS).nullable().optional(),
  // For paid courses only; price in USD minor units (cents).
  price_cents: z.number().int().nonnegative().optional(),
  /** Duration estimate shown on the catalog card. */
  total_minutes: z.number().int().nonnegative().default(0),
  /** Hero artwork (Cloudflare Images path). */
  hero_image_url: z.string().url().nullable().optional(),
  /** SEO meta — every course is a landing page. */
  seo_title: z.string().max(80).optional(),
  seo_description: z.string().max(180).optional(),
  /** Counts toward Strategist certification (advanced ladder). */
  counts_toward_strategist: z.boolean().default(false),
  /** Special cert flag: this is the Agency Partner cert course. */
  is_agency_partner_cert: z.boolean().default(false),
});
export type CourseMeta = z.infer<typeof CourseMetaSchema>;

export interface Course extends CourseMeta {
  id: string;
  status: CourseStatus;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export const ModuleInputSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  order: z.number().int().nonnegative(),
});
export type ModuleInput = z.infer<typeof ModuleInputSchema>;

export interface Module extends ModuleInput {
  id: string;
  course_id: string;
  created_at: string;
  updated_at: string;
}

export const LessonBodyVideoSchema = z.object({
  type: z.literal("video"),
  /** Cloudflare Stream UID. */
  cf_stream_uid: z.string().min(1),
  /** HLS playlist URL (signed when watermark enabled). */
  hls_url: z.string().url(),
  duration_seconds: z.number().int().nonnegative(),
  /** Captions per language (ISO 639-1 â†’ URL). */
  captions: z.record(z.string().url()).default({}),
  /** Watermarked tokens require per-user signed playback. */
  watermarked: z.boolean().default(false),
});
export type LessonBodyVideo = z.infer<typeof LessonBodyVideoSchema>;

export const LessonBodyTextSchema = z.object({
  type: z.literal("text"),
  markdown: z.string().min(1),
  reading_minutes: z.number().int().nonnegative().default(0),
});
export type LessonBodyText = z.infer<typeof LessonBodyTextSchema>;

export const LessonBodyQuizSchema = z.object({
  type: z.literal("quiz"),
  quiz_id: z.string().min(1),
});
export type LessonBodyQuiz = z.infer<typeof LessonBodyQuizSchema>;

export const LessonBodyExerciseSchema = z.object({
  type: z.literal("exercise"),
  prompt_markdown: z.string().min(1),
  /** Optional rubric the mentor or auto-grader uses. */
  rubric: z
    .array(z.object({ criterion: z.string(), max_points: z.number().int().positive() }))
    .default([]),
  submission_kind: z.enum(["text", "url", "file"]).default("text"),
});
export type LessonBodyExercise = z.infer<typeof LessonBodyExerciseSchema>;

export const LessonBodyCapstoneSchema = z.object({
  type: z.literal("capstone"),
  /** Brief shown to the student. */
  brief_markdown: z.string().min(1),
  /** Required deliverables for graduation. */
  deliverables: z.array(z.string()).default([]),
  /** Whether this capstone uses the "matched local business" pool. */
  uses_local_business_pool: z.boolean().default(true),
});
export type LessonBodyCapstone = z.infer<typeof LessonBodyCapstoneSchema>;

export const LessonBodySchema = z.discriminatedUnion("type", [
  LessonBodyVideoSchema,
  LessonBodyTextSchema,
  LessonBodyQuizSchema,
  LessonBodyExerciseSchema,
  LessonBodyCapstoneSchema,
]);
export type LessonBody = z.infer<typeof LessonBodySchema>;

export const LessonInputSchema = z.object({
  title: z.string().min(1).max(160),
  order: z.number().int().nonnegative(),
  body: LessonBodySchema,
  /** Marks the lesson as required for course completion. */
  required: z.boolean().default(true),
});
export type LessonInput = z.infer<typeof LessonInputSchema>;

export interface Lesson extends LessonInput {
  id: string;
  course_id: string;
  module_id: string;
  created_at: string;
  updated_at: string;
}

/* ===== Quizzes ========================================================= */

export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(QUIZ_QUESTION_TYPES),
  prompt: z.string().min(1),
  /** For multiple_choice / multi_select / true_false. */
  choices: z
    .array(z.object({ id: z.string(), text: z.string() }))
    .optional(),
  /** Correct choice IDs (or canonical answer string for short_answer). */
  answer: z.union([z.array(z.string()), z.string()]),
  /** Per-question score weight. */
  points: z.number().int().positive().default(1),
  /** Rationale shown after grading. */
  explanation: z.string().optional(),
  /** For code_fill_in: starter code + blanks. */
  code_starter: z.string().optional(),
  blanks: z.array(z.string()).optional(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  questions: z.array(QuizQuestionSchema).min(1),
  /** Percentage required to pass. Doc 13 Â§3 = 80% for the Agency cert. */
  passing_pct: z.number().int().min(0).max(100).default(70),
  /** Retake cooldown — Doc 13 says 7 days. */
  retake_cooldown_days: z.number().int().min(0).default(0),
  /** If true, this quiz counts as the course's certification gate. */
  is_certification_quiz: z.boolean().default(false),
  shuffle: z.boolean().default(true),
});
export type Quiz = z.infer<typeof QuizSchema>;

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  enrollment_id: string;
  started_at: string;
  submitted_at: string | null;
  score_pct: number | null;
  passed: boolean;
  /** Per-question scores for transcript audit. */
  breakdown: Array<{ question_id: string; awarded: number; max: number }>;
  attempt_n: number;
}

/* ===== Progress / Enrollment =========================================== */

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  /** Set when a paid course was purchased; null for free. */
  invoice_id: string | null;
  /** Cohort assignment for cohort-based programs. */
  cohort_id: string | null;
  /** Institution this enrollment belongs to (free Education tier). */
  institution_id: string | null;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  refunded_at: string | null;
  /** Total % progress, denormalized for catalog/dashboard reads. */
  progress_pct: number;
  /** ID of the last lesson the user opened — used for "resume where left off". */
  last_lesson_id: string | null;
}

export interface Progress {
  id: string;
  user_id: string;
  course_id: string;
  module_id: string;
  lesson_id: string;
  status: ProgressStatus;
  /** For video lessons: % watched (0-100). */
  watched_pct: number;
  /** Seconds completed — used for resume + drop-off analytics. */
  position_seconds: number;
  /** Last quiz score on this lesson if it's a quiz. */
  best_score_pct: number | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

/** Per-playback-session telemetry row (for the drop-off heatmap). */
export interface LessonPlaybackSession {
  id: string;
  user_id: string;
  lesson_id: string;
  started_at: string;
  ended_at: string | null;
  /** Furthest second the user watched in this session. */
  max_position_seconds: number;
  /** True if user paused/closed before completion. */
  dropped_off: boolean;
  /** Watermarked playback token used (so we can revoke if leaked). */
  watermark_token: string | null;
}

/* ===== Certifications ================================================== */

export interface Certification {
  id: string;
  user_id: string;
  kind: CertKind;
  /** Verifiable public ID printed on the credential. */
  verifiable_id: string;
  /** Snapshot of the courses + quiz scores that satisfied the cert. */
  basis: {
    course_ids: string[];
    quiz_scores: Array<{ quiz_id: string; pct: number }>;
    capstone_id?: string;
    mentor_review_id?: string;
  };
  issued_at: string;
  /** Strategist + Agency Partner credentials expire annually. */
  expires_at: string | null;
  revoked_at: string | null;
  /** Listed in the public Partner Directory (Agency Partner only). */
  listed_in_directory: boolean;
  /** Cached LinkedIn share URL. */
  linkedin_share_url: string;
  /** Cached public credential view URL. */
  public_url: string;
}

/* ===== Capstones ======================================================= */

export interface Capstone {
  id: string;
  enrollment_id: string;
  user_id: string;
  course_id: string;
  /** The local business matched from the opt-in pool. Nullable in `matching` state. */
  business_workspace_id: string | null;
  status: CapstoneStatus;
  /** ISO date 90 days after `kickoff_at`. */
  kickoff_at: string | null;
  graduation_due_at: string | null;
  /** Mentor assigned to oversee both sides. */
  mentor_user_id: string | null;
  /** Outcomes measured at graduation. */
  outcomes: {
    leads_captured: number;
    revtry_calls_completed: number;
    booked_appointments: number;
    revenue_attributed_cents: number;
  };
  /** Mentor review verdict gates the Strategist cert. */
  mentor_review_passed: boolean | null;
  /** Did the business convert to a paying GoFunnelAI customer? */
  business_converted_to_customer: boolean;
  created_at: string;
  updated_at: string;
}

/** A local business that opted in to be matched as a capstone partner. */
export interface CapstoneBusinessProfile {
  workspace_id: string;
  vertical: IndustryVertical;
  city: string;
  region: string;
  country: string;
  /** Owner self-declared monthly revenue band — used to match difficulty. */
  revenue_band: "<10k" | "10k-50k" | "50k-200k" | "200k+";
  opted_in_at: string;
  matched_capstone_id: string | null;
}

/* ===== College pipeline ================================================ */

export interface Institution {
  id: string;
  /** Legal name (e.g. "Howard University"). */
  legal_name: string;
  display_name: string;
  type: InstitutionType;
  /** OPE ID / institution code for transcript verification. */
  ope_id: string | null;
  country: string;
  region: string;
  /** Domain auto-grants student accounts (`@howard.edu`). */
  email_domain: string;
  /** Free GoFunnelAI for Education tier — no seat limit. */
  unlimited_seats: boolean;
  /** Active student-account count (denormalized for dashboards). */
  student_count: number;
  /** Active educator count. */
  educator_count: number;
  /** LTI 1.3 issuer URL, set on integration. */
  lti_issuer: string | null;
  /** LTI 1.3 client ID. */
  lti_client_id: string | null;
  /** Which LMS the institution uses (we publish one tool per kind). */
  lms_kind: LmsKind | null;
  /** Public listing in the educator program directory. */
  listed_in_education_directory: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstitutionMembership {
  id: string;
  institution_id: string;
  user_id: string;
  role: "student" | "educator" | "admin";
  cohort_id: string | null;
  joined_at: string;
  removed_at: string | null;
}

export interface CareerPlacement {
  id: string;
  user_id: string;
  institution_id: string | null;
  /** Set when the student is listed for hire. */
  listed_for_hire: boolean;
  listed_at: string | null;
  /** Vertical the student specialized in (drives ranked-search in the directory). */
  vertical: IndustryVertical | null;
  /** Optional 3-month deferred follow-up: did they get placed? */
  placed_at: string | null;
  placement_company_name: string | null;
  placement_role: string | null;
  placement_salary_band: "<40k" | "40k-60k" | "60k-90k" | "90k+" | null;
}

/* ===== Paid programs + cohorts ========================================= */

export interface PaidProgram {
  id: string;
  course_id: string;
  /** Marketing-facing program name (e.g. "HVAC Funnel Mastery"). */
  name: string;
  /** USD cents. Doc spec: $297-$1,997. */
  price_cents: number;
  /** Cohort-based or self-paced. */
  delivery: "cohort" | "self_paced";
  /** Refund window aligned to Doc 05d (default 14 days, no refund after first live session). */
  refund_window_days: number;
  /** Refund forfeited once this many lessons are completed. */
  refund_forfeit_after_lessons: number;
  /** Stripe price ID. */
  stripe_price_id: string;
  /** PayPal plan ID (primary processor per Doc 04 — fallback to Stripe). */
  paypal_plan_id: string | null;
  active: boolean;
}

export interface Cohort {
  id: string;
  program_id: string;
  course_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  enrolled_count: number;
  /** Lecture call schedule (ICS-style). */
  schedule: Array<{ at: string; topic: string; zoom_url?: string }>;
  /** Slack channel (or Discord) for the cohort. */
  community_channel: string | null;
  status: "open" | "full" | "in_session" | "completed";
}

/* ===== SEO ============================================================ */

export interface AcademySeoPage {
  id: string;
  course_id: string;
  /** Slug under /academy/ (e.g. "marketing-for-hvac"). */
  url_path: string;
  title: string;
  meta_description: string;
  /** Canonical keyword cluster — "marketing for [industry]" pattern. */
  primary_keyword: string;
  /** Auto-rendered FAQ schema.org/FAQPage. */
  faq: Array<{ q: string; a: string }>;
  /** Auto-rendered Course schema.org structured data. */
  schema_org_json_ld: Record<string, unknown>;
  /** SSR-rendered HTML cached for crawlers. */
  rendered_html_cache_key: string | null;
  last_rendered_at: string | null;
}

/* ===== Event envelopes (extends Doc 03 Â§A) ============================= */

export const AcademyEventNames = [
  "academy.course.published",
  "academy.course.archived",
  "academy.enrollment.created",
  "academy.enrollment.refunded",
  "academy.lesson.started",
  "academy.lesson.completed",
  "academy.quiz.attempted",
  "academy.quiz.passed",
  "academy.certification.issued",
  "academy.certification.revoked",
  "academy.capstone.matched",
  "academy.capstone.graduated",
  "academy.institution.connected",
  "academy.institution.lti_launched",
  "academy.career.listed_for_hire",
] as const;
export type AcademyEventName = (typeof AcademyEventNames)[number];
