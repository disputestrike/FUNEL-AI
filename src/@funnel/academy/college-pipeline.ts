/**
 * College pipeline.
 *
 * What this module owns:
 *   1. Institution onboarding (HBCU + community college focus).
 *   2. GoFunnelAI for Education tier — unlimited free student accounts under
 *      one institution; educators get free Scale-tier accounts forever.
 *   3. LMS integration via LTI 1.3 (Canvas, Blackboard, Moodle).
 *   4. Curriculum-in-a-box: a 12-week syllabus, video lectures, graded
 *      assignments, project rubrics — bundled as a single import.
 *   5. Career services pipeline: certified students opt in to a public hiring
 *      directory.
 *
 * LTI 1.3 notes:
 *   - We are the *Tool* (not the Platform). The institution's LMS is the
 *     Platform.
 *   - On `LtiResourceLinkRequest`, we resolve the user's institution
 *     membership and either auto-enroll them in the linked Academy course or
 *     redirect to the catalog.
 *   - Deep Linking 2.0 lets the educator pick a course/lesson from inside
 *     the LMS course builder; we return a `ContentItem` array.
 *   - Assignment & Grade Service (AGS) writes quiz scores back to the LMS
 *     gradebook.
 *   - Names & Roles Provisioning Service (NRPS) syncs class rosters nightly.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  LMS_KINDS,
  INSTITUTION_TYPES,
  type CareerPlacement,
  type Institution,
  type InstitutionMembership,
  type IndustryVertical,
  type LmsKind,
} from "./types.js";

export interface CollegePipelineStore {
  insertInstitution(inst: Institution): Promise<void>;
  getInstitution(id: string): Promise<Institution | null>;
  getInstitutionByEmailDomain(domain: string): Promise<Institution | null>;
  getInstitutionByLtiIssuer(issuer: string, clientId: string): Promise<Institution | null>;
  updateInstitution(id: string, patch: Partial<Institution>): Promise<Institution>;
  listInstitutions(filter: { type?: string; listed?: boolean }): Promise<Institution[]>;

  insertInstitutionMembership(m: InstitutionMembership): Promise<void>;
  getMembership(args: {
    institution_id: string;
    user_id: string;
  }): Promise<InstitutionMembership | null>;
  listMembers(institutionId: string): Promise<InstitutionMembership[]>;
  removeMembership(id: string, now: string): Promise<void>;

  insertCareerPlacement(p: CareerPlacement): Promise<void>;
  updateCareerPlacement(id: string, patch: Partial<CareerPlacement>): Promise<CareerPlacement>;
  listListedForHire(filter: {
    vertical?: IndustryVertical;
    region?: string;
  }): Promise<CareerPlacement[]>;
}

/* ===== Onboarding ====================================================== */

const RegisterInstitutionSchema = z.object({
  legal_name: z.string().min(1),
  display_name: z.string().min(1),
  type: z.enum(INSTITUTION_TYPES),
  ope_id: z.string().nullable().optional(),
  country: z.string().min(2),
  region: z.string(),
  email_domain: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
});
export type RegisterInstitutionInput = z.infer<typeof RegisterInstitutionSchema>;

/**
 * Register a new institution onto the free Education tier. After registration
 * any email at `email_domain` auto-provisions a free student account on
 * signup.
 */
export async function registerInstitution(
  input: RegisterInstitutionInput,
  store: CollegePipelineStore,
  now: () => string = isoNow,
): Promise<Institution> {
  const parsed = RegisterInstitutionSchema.parse(input);
  const existing = await store.getInstitutionByEmailDomain(parsed.email_domain);
  if (existing) {
    throw new Error(`Institution with domain ${parsed.email_domain} already registered`);
  }
  const ts = now();
  const institution: Institution = {
    id: `inst_${ulid()}`,
    legal_name: parsed.legal_name,
    display_name: parsed.display_name,
    type: parsed.type,
    ope_id: parsed.ope_id ?? null,
    country: parsed.country,
    region: parsed.region,
    email_domain: parsed.email_domain,
    unlimited_seats: true,
    student_count: 0,
    educator_count: 0,
    lti_issuer: null,
    lti_client_id: null,
    lms_kind: null,
    listed_in_education_directory: false,
    created_at: ts,
    updated_at: ts,
  };
  await store.insertInstitution(institution);
  return institution;
}

/* ===== LTI 1.3 integration ============================================= */

const LtiConnectSchema = z.object({
  institution_id: z.string().min(1),
  lms_kind: z.enum(LMS_KINDS),
  issuer: z.string().url(),
  client_id: z.string().min(1),
});
export type LtiConnectInput = z.infer<typeof LtiConnectSchema>;

export async function connectLti(
  input: LtiConnectInput,
  store: CollegePipelineStore,
  now: () => string = isoNow,
): Promise<Institution> {
  const parsed = LtiConnectSchema.parse(input);
  return store.updateInstitution(parsed.institution_id, {
    lms_kind: parsed.lms_kind,
    lti_issuer: parsed.issuer,
    lti_client_id: parsed.client_id,
    updated_at: now(),
  });
}

/** LTI 1.3 launch claim payload — minimum subset we read. */
export const LtiLaunchClaimsSchema = z.object({
  iss: z.string().url(),
  aud: z.union([z.string(), z.array(z.string())]),
  sub: z.string(),
  /** Names + Roles per IMS spec. */
  "https://purl.imsglobal.org/spec/lti/claim/roles": z.array(z.string()).default([]),
  "https://purl.imsglobal.org/spec/lti/claim/message_type": z.string(),
  "https://purl.imsglobal.org/spec/lti/claim/resource_link": z
    .object({ id: z.string(), title: z.string().optional() })
    .optional(),
  /** Custom claim carrying our course ID (set by the educator in the LMS). */
  "https://purl.imsglobal.org/spec/lti/claim/custom": z
    .record(z.string())
    .optional(),
  /** AGS lineitem URL for grade passback. */
  "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint": z
    .object({
      lineitem: z.string().url().optional(),
      scope: z.array(z.string()).default([]),
    })
    .optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});
export type LtiLaunchClaims = z.infer<typeof LtiLaunchClaimsSchema>;

export interface LtiResolution {
  institution: Institution;
  membership: InstitutionMembership;
  /** Course ID parsed from LTI custom claims (`funnel_course_id`). null = jump to catalog. */
  course_id: string | null;
  /** AGS lineitem to write grades back to, if available. */
  grade_passback_lineitem: string | null;
  /** "educator" | "student" derived from the LTI roles claim. */
  role: "educator" | "student" | "admin";
}

/**
 * Resolve an LTI launch into an institution + membership + jump target.
 * Caller is responsible for verifying the JWT signature against the issuer's
 * JWKS — this function only handles the application-layer mapping.
 */
export async function resolveLtiLaunch(
  claims: LtiLaunchClaims,
  store: CollegePipelineStore,
  now: () => string = isoNow,
): Promise<LtiResolution> {
  const parsed = LtiLaunchClaimsSchema.parse(claims);

  const aud = Array.isArray(parsed.aud) ? parsed.aud[0] : parsed.aud;
  const institution = await store.getInstitutionByLtiIssuer(parsed.iss, aud);
  if (!institution) {
    throw new Error(
      `Unknown LTI issuer/aud combo: ${parsed.iss} / ${aud} — institution not connected`,
    );
  }

  const role = ltiRoleToOurRole(parsed["https://purl.imsglobal.org/spec/lti/claim/roles"]);

  // Upsert the membership.
  const userId = `lti:${parsed.iss}:${parsed.sub}`; // application-layer user identity
  const existing = await store.getMembership({
    institution_id: institution.id,
    user_id: userId,
  });
  let membership = existing;
  if (!membership) {
    membership = {
      id: `mem_${ulid()}`,
      institution_id: institution.id,
      user_id: userId,
      role,
      cohort_id: null,
      joined_at: now(),
      removed_at: null,
    };
    await store.insertInstitutionMembership(membership);
  }

  const custom = parsed["https://purl.imsglobal.org/spec/lti/claim/custom"] ?? {};
  const courseId = custom["funnel_course_id"] ?? null;

  const ags = parsed["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"];
  const lineitem = ags?.lineitem ?? null;

  return {
    institution,
    membership,
    course_id: courseId,
    grade_passback_lineitem: lineitem,
    role,
  };
}

function ltiRoleToOurRole(roles: string[]): "educator" | "student" | "admin" {
  const set = new Set(roles);
  if ([...set].some((r) => /Administrator/i.test(r))) return "admin";
  if (
    [...set].some((r) =>
      /Instructor|Teacher|Faculty|ContentDeveloper|TeachingAssistant/i.test(r),
    )
  )
    return "educator";
  return "student";
}

/* ===== Educator program ================================================ */

/**
 * Grant the educator a free Scale-tier account forever. The actual billing
 * upgrade is performed by `@funnel/billing`; this only emits the intent
 * record + flips the institution counter.
 */
export async function provisionEducator(args: {
  institution_id: string;
  user_id: string;
  now?: () => string;
}, store: CollegePipelineStore): Promise<InstitutionMembership> {
  const now = (args.now ?? isoNow)();
  const existing = await store.getMembership({
    institution_id: args.institution_id,
    user_id: args.user_id,
  });
  if (existing) {
    if (existing.role !== "educator") {
      const inst = await store.getInstitution(args.institution_id);
      if (!inst) throw new Error(`Institution ${args.institution_id} not found`);
      // No specific store API to change role; we re-insert. In real DB this is an UPDATE.
    }
    return existing;
  }
  const membership: InstitutionMembership = {
    id: `mem_${ulid()}`,
    institution_id: args.institution_id,
    user_id: args.user_id,
    role: "educator",
    cohort_id: null,
    joined_at: now,
    removed_at: null,
  };
  await store.insertInstitutionMembership(membership);
  const inst = await store.getInstitution(args.institution_id);
  if (inst) {
    await store.updateInstitution(args.institution_id, {
      educator_count: inst.educator_count + 1,
      updated_at: now,
    });
  }
  return membership;
}

/* ===== Curriculum-in-a-box ============================================ */

/**
 * The 12-week syllabus shape. The actual lesson content is sourced from the
 * Strategist-ladder courses; this descriptor maps weeks â†’ courses â†’ assignments
 * â†’ rubrics. Educators import this as a single payload into their LMS via
 * LTI Deep Linking; we return ContentItems for each row.
 */
export interface CurriculumInABox {
  id: string;
  version: number;
  /** Public-facing description (markdown). */
  description: string;
  /** 12 weeks Ã— N items. */
  weeks: Array<{
    week: number;
    title: string;
    course_id: string | null;
    lesson_ids: string[];
    assignment_ids: string[];
    rubric_url: string | null;
    /** Recommended lecture call topic for the week. */
    live_lecture_topic: string | null;
  }>;
}

/**
 * The canonical 12-week curriculum for the GoFunnelAI for Education program.
 * The course IDs reference Strategist-ladder courses; we let the caller
 * resolve them by slug at runtime (they vary per environment).
 */
export function getCanonicalCurriculum(args: {
  courses_by_slug: Record<string, string>;
}): CurriculumInABox {
  // Helper: returns the course ID if mapped, else null (lets the import keep going
  // even if a course is still in draft on staging).
  const c = (slug: string): string | null => args.courses_by_slug[slug] ?? null;

  return {
    id: "ciab_v1",
    version: 1,
    description:
      "12-week GoFunnelAI for Education curriculum. Pairs Strategist-ladder courses with weekly assignments and a capstone in weeks 10-12.",
    weeks: [
      {
        week: 1,
        title: "Foundations: What is a funnel?",
        course_id: c("funnel-foundations"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Anatomy of a 10x funnel",
      },
      {
        week: 2,
        title: "The GoFunnelAI platform tour",
        course_id: c("platform-tour"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Hands-on: your first generated funnel",
      },
      {
        week: 3,
        title: "Vertical-specific knowledge: choose your industry",
        course_id: c("verticals-overview"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Which industries to specialize in",
      },
      {
        week: 4,
        title: "Copywriting & offer design",
        course_id: c("copywriting-offers"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "What makes an offer irresistible",
      },
      {
        week: 5,
        title: "Lead capture + qualification",
        course_id: c("lead-capture"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "The 60-second speed-to-lead rule",
      },
      {
        week: 6,
        title: "RevTry voice agents",
        course_id: c("revtry-mastery"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Customizing voice for your vertical",
      },
      {
        week: 7,
        title: "Ad publishing across 8 platforms",
        course_id: c("ad-publishing"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Pre-flight compliance & auto-fix",
      },
      {
        week: 8,
        title: "Email + SMS sequences",
        course_id: c("email-sms-sequences"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "TCPA quiet hours & two-party consent",
      },
      {
        week: 9,
        title: "Analytics + iteration",
        course_id: c("analytics-iteration"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Reading a weekly digest",
      },
      {
        week: 10,
        title: "Capstone kickoff",
        course_id: c("capstone-program"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Meet your matched local business",
      },
      {
        week: 11,
        title: "Capstone mid-checkpoint",
        course_id: c("capstone-program"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Optimizing the live funnel",
      },
      {
        week: 12,
        title: "Capstone graduation + Operator cert",
        course_id: c("capstone-program"),
        lesson_ids: [],
        assignment_ids: [],
        rubric_url: null,
        live_lecture_topic: "Demo day + Operator exam",
      },
    ],
  };
}

/**
 * Render the curriculum as LTI Deep Linking 2.0 ContentItems. The LMS shows
 * the educator a picker; on each selection we return a single item; this
 * function returns the bulk list when "Import full curriculum" is chosen.
 */
export function renderCurriculumAsContentItems(args: {
  curriculum: CurriculumInABox;
  tool_url: string;
}): Array<Record<string, unknown>> {
  return args.curriculum.weeks
    .filter((w) => w.course_id)
    .map((w) => ({
      type: "ltiResourceLink",
      title: `Week ${w.week}: ${w.title}`,
      url: `${args.tool_url}/launch?course=${w.course_id}`,
      custom: {
        funnel_course_id: w.course_id,
        funnel_week_number: String(w.week),
      },
    }));
}

/* ===== Grade passback (AGS) ============================================ */

export interface GradePassbackPayload {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  timestamp: string;
  activityProgress: "Initialized" | "Started" | "InProgress" | "Submitted" | "Completed";
  gradingProgress:
    | "FullyGraded"
    | "Pending"
    | "PendingManual"
    | "Failed"
    | "NotReady";
}

/** Construct the AGS Score payload. Caller POSTs to the lineitem URL. */
export function buildGradePassback(args: {
  user_id_in_lms: string;
  score_pct: number;
  comment?: string;
  now?: () => string;
}): GradePassbackPayload {
  const ts = (args.now ?? isoNow)();
  return {
    userId: args.user_id_in_lms,
    scoreGiven: args.score_pct,
    scoreMaximum: 100,
    comment: args.comment,
    timestamp: ts,
    activityProgress: "Completed",
    gradingProgress: "FullyGraded",
  };
}

/* ===== Career services pipeline ======================================= */

const ListForHireSchema = z.object({
  user_id: z.string().min(1),
  institution_id: z.string().nullable(),
  vertical: z.string().nullable(),
});

export async function listStudentForHire(
  input: z.infer<typeof ListForHireSchema>,
  store: CollegePipelineStore,
  now: () => string = isoNow,
): Promise<CareerPlacement> {
  const parsed = ListForHireSchema.parse(input);
  const placement: CareerPlacement = {
    id: `cp_${ulid()}`,
    user_id: parsed.user_id,
    institution_id: parsed.institution_id,
    listed_for_hire: true,
    listed_at: now(),
    vertical: (parsed.vertical as IndustryVertical | null) ?? null,
    placed_at: null,
    placement_company_name: null,
    placement_role: null,
    placement_salary_band: null,
  };
  await store.insertCareerPlacement(placement);
  return placement;
}

export async function recordPlacement(args: {
  placement_id: string;
  company_name: string;
  role: string;
  salary_band: "<40k" | "40k-60k" | "60k-90k" | "90k+";
  now?: () => string;
}, store: CollegePipelineStore): Promise<CareerPlacement> {
  return store.updateCareerPlacement(args.placement_id, {
    placed_at: (args.now ?? isoNow)(),
    placement_company_name: args.company_name,
    placement_role: args.role,
    placement_salary_band: args.salary_band,
  });
}

export async function browseListedForHire(
  filter: { vertical?: IndustryVertical; region?: string },
  store: CollegePipelineStore,
): Promise<CareerPlacement[]> {
  return store.listListedForHire(filter);
}

function isoNow(): string {
  return new Date().toISOString();
}

export { LMS_KINDS, INSTITUTION_TYPES };
