/**
 * Certifications.
 *
 * Three ladders (spec):
 *
 *   1. **Certified GoFunnelAI Operator** (basic)
 *      - Completion of the "Operator Foundations" course
 *      - >= 70% on the certification quiz
 *      - Free, perpetual (does not expire)
 *
 *   2. **Certified GoFunnelAI Strategist** (advanced)
 *      - All 50+ Strategist-ladder courses completed
 *      - Capstone graduated (mentor review passed)
 *      - Expires annually (renewable via mini-cert)
 *
 *   3. **Certified GoFunnelAI Agency Partner**
 *      - The doc-13 Â§3 cert course completed (8 modules, 30min)
 *      - >= 80% on the 20-question exam
 *      - Listed in the public Partner Directory
 *      - Expires annually
 *
 * On issue, we mint:
 *   - a verifiable_id (publicly resolvable at /credential/<id>)
 *   - a LinkedIn `addToProfile` share URL
 *   - an `academy.certification.issued` event for the data lake
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  CERT_KINDS,
  type Capstone,
  type CertKind,
  type Certification,
  type Course,
  type Enrollment,
  type Quiz,
  type QuizAttempt,
} from "./types.js";

export interface CertificationStore {
  insertCertification(cert: Certification): Promise<void>;
  getCertification(id: string): Promise<Certification | null>;
  getCertificationByVerifiableId(vid: string): Promise<Certification | null>;
  listCertificationsByUser(userId: string): Promise<Certification[]>;
  updateCertification(id: string, patch: Partial<Certification>): Promise<Certification>;

  /** Catalog reads needed for eligibility checks. */
  getCourse(id: string): Promise<Course | null>;
  listStrategistCourses(): Promise<Course[]>;
  getAgencyPartnerCertCourse(): Promise<Course | null>;
  listEnrollmentsByUser(userId: string): Promise<Enrollment[]>;
  bestQuizAttempt(args: { user_id: string; quiz_id: string }): Promise<QuizAttempt | null>;
  getCertificationQuizForCourse(courseId: string): Promise<Quiz | null>;
  getCapstone(id: string): Promise<Capstone | null>;
  /** Capstones graduated by this user. */
  listGraduatedCapstones(userId: string): Promise<Capstone[]>;
}

/* ===== Eligibility checks ============================================== */

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  passing_quiz_attempt?: QuizAttempt;
  capstone?: Capstone;
}

/**
 * Operator eligibility: completed "Operator Foundations" course + >= 70% on
 * its cert quiz.
 */
export async function checkOperatorEligibility(
  userId: string,
  operatorCourseId: string,
  store: CertificationStore,
): Promise<EligibilityResult> {
  const reasons: string[] = [];
  const enrollments = await store.listEnrollmentsByUser(userId);
  const enrollment = enrollments.find((e) => e.course_id === operatorCourseId);
  if (!enrollment) {
    return { eligible: false, reasons: ["not_enrolled_in_operator_course"] };
  }
  if (enrollment.status !== "completed") {
    reasons.push(`operator_course_not_completed (status=${enrollment.status})`);
  }
  const quiz = await store.getCertificationQuizForCourse(operatorCourseId);
  if (!quiz) {
    return { eligible: false, reasons: ["operator_course_missing_cert_quiz"] };
  }
  const attempt = await store.bestQuizAttempt({ user_id: userId, quiz_id: quiz.id });
  if (!attempt || !attempt.passed || (attempt.score_pct ?? 0) < 70) {
    reasons.push("operator_quiz_not_passed_at_70");
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    passing_quiz_attempt: attempt ?? undefined,
  };
}

/**
 * Strategist eligibility: every Strategist-ladder course completed + capstone
 * graduated + mentor review passed.
 */
export async function checkStrategistEligibility(
  userId: string,
  store: CertificationStore,
): Promise<EligibilityResult> {
  const reasons: string[] = [];
  const all = await store.listStrategistCourses();
  const enrollments = await store.listEnrollmentsByUser(userId);
  const completed = new Set(
    enrollments.filter((e) => e.status === "completed").map((e) => e.course_id),
  );
  const missing = all.filter((c) => !completed.has(c.id));
  if (missing.length > 0) {
    reasons.push(`strategist_courses_incomplete (${missing.length} remaining)`);
  }
  const graduated = await store.listGraduatedCapstones(userId);
  const passed = graduated.find((c) => c.mentor_review_passed === true);
  if (!passed) {
    reasons.push("strategist_capstone_or_mentor_review_missing");
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    capstone: passed,
  };
}

/**
 * Agency Partner eligibility: doc-13 cert course completed + >= 80% on the
 * 20-question exam. On issue, we list the user (their agency) in the
 * Partner Directory (Doc 13 Â§1 Slide 14).
 */
export async function checkAgencyPartnerEligibility(
  userId: string,
  store: CertificationStore,
): Promise<EligibilityResult> {
  const reasons: string[] = [];
  const course = await store.getAgencyPartnerCertCourse();
  if (!course) {
    return { eligible: false, reasons: ["agency_partner_cert_course_not_configured"] };
  }
  const enrollments = await store.listEnrollmentsByUser(userId);
  const enrollment = enrollments.find((e) => e.course_id === course.id);
  if (!enrollment || enrollment.status !== "completed") {
    reasons.push("agency_partner_course_not_completed");
  }
  const quiz = await store.getCertificationQuizForCourse(course.id);
  if (!quiz) {
    return { eligible: false, reasons: ["agency_partner_course_missing_cert_quiz"] };
  }
  const attempt = await store.bestQuizAttempt({ user_id: userId, quiz_id: quiz.id });
  if (!attempt || !attempt.passed || (attempt.score_pct ?? 0) < 80) {
    reasons.push("agency_partner_quiz_not_passed_at_80");
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    passing_quiz_attempt: attempt ?? undefined,
  };
}

/* ===== Issue ========================================================== */

const IssueInputSchema = z.object({
  user_id: z.string().min(1),
  kind: z.enum(CERT_KINDS),
  course_ids: z.array(z.string()).default([]),
  quiz_scores: z
    .array(
      z.object({
        quiz_id: z.string(),
        pct: z.number().min(0).max(100),
      }),
    )
    .default([]),
  capstone_id: z.string().optional(),
  mentor_review_id: z.string().optional(),
});
export type IssueInput = z.infer<typeof IssueInputSchema>;

/**
 * Issue a credential. The caller must have already verified eligibility via
 * `checkOperatorEligibility` / `checkStrategistEligibility` /
 * `checkAgencyPartnerEligibility`.
 *
 * - Operator credentials never expire.
 * - Strategist + Agency Partner credentials expire one year from issuance.
 * - Agency Partner credentials list in the public directory on issue.
 */
export async function issueCertification(
  input: IssueInput,
  store: CertificationStore,
  cfg: {
    /** Base URL where verifiable credentials resolve (e.g. https://academy.gofunnelai.com). */
    public_base_url: string;
  },
  now: () => Date = () => new Date(),
): Promise<Certification> {
  const parsed = IssueInputSchema.parse(input);
  const ts = now();
  const id = `cert_${ulid()}`;
  // Verifiable ID is a short, type-prefixed token (e.g. FOP-7G3K-9XV2)
  // shown on the printable cert + the public verifier page.
  const verifiableId = mintVerifiableId(parsed.kind, ts.getTime());
  const publicUrl = `${cfg.public_base_url}/credential/${verifiableId}`;

  const expiresAt =
    parsed.kind === "certified_operator"
      ? null
      : new Date(ts.getFullYear() + 1, ts.getMonth(), ts.getDate()).toISOString();

  const cert: Certification = {
    id,
    user_id: parsed.user_id,
    kind: parsed.kind,
    verifiable_id: verifiableId,
    basis: {
      course_ids: parsed.course_ids,
      quiz_scores: parsed.quiz_scores,
      capstone_id: parsed.capstone_id,
      mentor_review_id: parsed.mentor_review_id,
    },
    issued_at: ts.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    listed_in_directory: parsed.kind === "certified_agency_partner",
    linkedin_share_url: buildLinkedInShareUrl({
      cert_kind: parsed.kind,
      verifiable_id: verifiableId,
      issued_at: ts,
      expires_at: expiresAt,
      public_url: publicUrl,
    }),
    public_url: publicUrl,
  };

  await store.insertCertification(cert);
  return cert;
}

/* ===== Revoke ========================================================= */

export async function revokeCertification(
  id: string,
  reason: string,
  store: CertificationStore,
  now: () => string = () => new Date().toISOString(),
): Promise<Certification> {
  const ts = now();
  return store.updateCertification(id, {
    revoked_at: ts,
    listed_in_directory: false,
    // We preserve `basis` so the audit trail survives revocation.
  });
}

/* ===== Public verifier ================================================= */

export interface VerifyResult {
  valid: boolean;
  certification: Certification | null;
  status: "valid" | "expired" | "revoked" | "not_found";
}

export async function verifyByVerifiableId(
  verifiableId: string,
  store: CertificationStore,
  now: () => Date = () => new Date(),
): Promise<VerifyResult> {
  const cert = await store.getCertificationByVerifiableId(verifiableId);
  if (!cert) return { valid: false, certification: null, status: "not_found" };
  if (cert.revoked_at) return { valid: false, certification: cert, status: "revoked" };
  if (cert.expires_at && new Date(cert.expires_at) < now()) {
    return { valid: false, certification: cert, status: "expired" };
  }
  return { valid: true, certification: cert, status: "valid" };
}

/**
 * Render a credential row for inclusion on a college transcript. Institutions
 * pull this via the LMS LTI integration (see college-pipeline.ts).
 */
export function renderTranscriptLine(cert: Certification): string {
  const kindLabel = ({
    certified_operator: "GoFunnelAI Certified Operator",
    certified_strategist: "GoFunnelAI Certified Strategist",
    certified_agency_partner: "GoFunnelAI Certified Agency Partner",
  } as const)[cert.kind];
  const issued = cert.issued_at.slice(0, 10);
  return `${kindLabel} (id ${cert.verifiable_id}, issued ${issued})`;
}

/* ===== Helpers ========================================================= */

function mintVerifiableId(kind: CertKind, ms: number): string {
  const prefix = ({
    certified_operator: "FOP",
    certified_strategist: "FST",
    certified_agency_partner: "FAP",
  } as const)[kind];
  // Encode time + 6 random base32 chars; collision risk negligible at scale.
  const base32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let rand = "";
  for (let i = 0; i < 6; i++) rand += base32[Math.floor(Math.random() * base32.length)];
  const time = ms.toString(36).toUpperCase().slice(-4);
  return `${prefix}-${time}-${rand}`;
}

/**
 * Build the LinkedIn "Add to Profile" deep link. LinkedIn's spec:
 * https://www.linkedin.com/help/linkedin/answer/a567005
 */
export function buildLinkedInShareUrl(args: {
  cert_kind: CertKind;
  verifiable_id: string;
  issued_at: Date;
  expires_at: string | null;
  public_url: string;
}): string {
  const name = ({
    certified_operator: "GoFunnelAI Certified Operator",
    certified_strategist: "GoFunnelAI Certified Strategist",
    certified_agency_partner: "GoFunnelAI Certified Agency Partner",
  } as const)[args.cert_kind];
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name,
    organizationName: "GoFunnelAI",
    issueYear: String(args.issued_at.getUTCFullYear()),
    issueMonth: String(args.issued_at.getUTCMonth() + 1),
    certUrl: args.public_url,
    certId: args.verifiable_id,
  });
  if (args.expires_at) {
    const exp = new Date(args.expires_at);
    params.set("expirationYear", String(exp.getUTCFullYear()));
    params.set("expirationMonth", String(exp.getUTCMonth() + 1));
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
