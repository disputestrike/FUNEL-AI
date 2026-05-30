/**
 * Quiz creation + grading.
 *
 * Question types supported:
 *   - multiple_choice   (single correct ID)
 *   - multi_select      (a set of correct IDs; partial credit at the question's points)
 *   - true_false        (just multiple_choice with two fixed options, exposed separately for editor UX)
 *   - scenario          (multi-question stem with a single choice expected)
 *   - code_fill_in      (one or more blanks; case-insensitive whole-token match)
 *   - short_answer      (canonical-answer match; case + punctuation insensitive)
 *
 * Grading is deterministic and pure — no LLM in the hot path. Quizzes that
 * need free-form review should use exercise lessons + mentor review instead.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  QuizSchema,
  QuizQuestionSchema,
  type Quiz,
  type QuizAttempt,
  type QuizQuestion,
} from "./types.js";

export interface QuizStore {
  insertQuiz(quiz: Quiz): Promise<void>;
  getQuiz(id: string): Promise<Quiz | null>;
  updateQuiz(id: string, patch: Partial<Quiz>): Promise<Quiz>;
  insertAttempt(attempt: QuizAttempt): Promise<void>;
  listAttemptsByUserQuiz(args: {
    user_id: string;
    quiz_id: string;
  }): Promise<QuizAttempt[]>;
}

/* ===== Create / update ================================================= */

export async function createQuiz(input: Quiz, store: QuizStore): Promise<Quiz> {
  const parsed = QuizSchema.parse({
    ...input,
    id: input.id || `qz_${ulid()}`,
  });
  // Per-question well-formedness checks (zod can't easily encode these because
  // they depend on `type`).
  for (const q of parsed.questions) {
    validateQuestionShape(q);
  }
  await store.insertQuiz(parsed);
  return parsed;
}

function validateQuestionShape(q: QuizQuestion): void {
  if (q.type === "multiple_choice" || q.type === "true_false" || q.type === "scenario") {
    if (!q.choices || q.choices.length < 2) {
      throw new Error(`Question ${q.id}: ${q.type} requires ≥2 choices`);
    }
    if (typeof q.answer !== "string" && !Array.isArray(q.answer)) {
      throw new Error(`Question ${q.id}: answer must reference a choice id`);
    }
  } else if (q.type === "multi_select") {
    if (!q.choices || q.choices.length < 2) {
      throw new Error(`Question ${q.id}: multi_select requires ≥2 choices`);
    }
    if (!Array.isArray(q.answer) || q.answer.length === 0) {
      throw new Error(`Question ${q.id}: multi_select answer must be a non-empty array`);
    }
  } else if (q.type === "code_fill_in") {
    if (!q.code_starter || !q.blanks || q.blanks.length === 0) {
      throw new Error(`Question ${q.id}: code_fill_in requires code_starter + blanks`);
    }
  }
}

/* ===== Submit + grade ================================================== */

const SubmissionSchema = z.object({
  quiz_id: z.string().min(1),
  user_id: z.string().min(1),
  enrollment_id: z.string().min(1),
  /** Map of question_id → user answer (string or string[]). */
  answers: z.record(z.union([z.string(), z.array(z.string())])),
});
export type QuizSubmission = z.infer<typeof SubmissionSchema>;

export interface GradedAttempt {
  attempt: QuizAttempt;
  passed: boolean;
  per_question: Array<{
    question_id: string;
    awarded: number;
    max: number;
    correct: boolean;
    explanation?: string;
  }>;
}

/**
 * Grade a quiz. Enforces retake cooldown if the previous attempt was a fail
 * within `retake_cooldown_days`.
 */
export async function submitQuiz(
  submission: QuizSubmission,
  store: QuizStore,
  now: () => Date = () => new Date(),
): Promise<GradedAttempt> {
  const parsed = SubmissionSchema.parse(submission);
  const quiz = await store.getQuiz(parsed.quiz_id);
  if (!quiz) throw new Error(`Quiz ${parsed.quiz_id} not found`);

  const priorAttempts = await store.listAttemptsByUserQuiz({
    user_id: parsed.user_id,
    quiz_id: parsed.quiz_id,
  });

  if (quiz.retake_cooldown_days > 0 && priorAttempts.length > 0) {
    const lastFailed = priorAttempts
      .filter((a) => a.passed === false && a.submitted_at)
      .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))[0];
    if (lastFailed?.submitted_at) {
      const cooldownMs = quiz.retake_cooldown_days * 24 * 60 * 60 * 1000;
      const since = now().getTime() - new Date(lastFailed.submitted_at).getTime();
      if (since < cooldownMs) {
        const wait = Math.ceil((cooldownMs - since) / (24 * 60 * 60 * 1000));
        throw new Error(
          `Retake cooldown active — try again in ${wait} day(s) (cooldown=${quiz.retake_cooldown_days}d)`,
        );
      }
    }
  }

  // Grade question-by-question.
  let totalAwarded = 0;
  let totalMax = 0;
  const perQ: GradedAttempt["per_question"] = [];
  const breakdown: QuizAttempt["breakdown"] = [];

  for (const q of quiz.questions) {
    const max = q.points;
    totalMax += max;
    const userAns = parsed.answers[q.id];
    const { awarded, correct } = gradeQuestion(q, userAns);
    totalAwarded += awarded;
    perQ.push({
      question_id: q.id,
      awarded,
      max,
      correct,
      explanation: q.explanation,
    });
    breakdown.push({ question_id: q.id, awarded, max });
  }

  const scorePct = totalMax === 0 ? 0 : Math.round((totalAwarded / totalMax) * 100);
  const passed = scorePct >= quiz.passing_pct;

  const attempt: QuizAttempt = {
    id: `qa_${ulid()}`,
    quiz_id: quiz.id,
    user_id: parsed.user_id,
    enrollment_id: parsed.enrollment_id,
    started_at: now().toISOString(),
    submitted_at: now().toISOString(),
    score_pct: scorePct,
    passed,
    breakdown,
    attempt_n: priorAttempts.length + 1,
  };

  await store.insertAttempt(attempt);

  return { attempt, passed, per_question: perQ };
}

/* ===== Per-question grading ============================================ */

function gradeQuestion(
  q: QuizQuestion,
  userAns: string | string[] | undefined,
): { awarded: number; correct: boolean } {
  if (userAns === undefined) return { awarded: 0, correct: false };

  if (q.type === "multiple_choice" || q.type === "true_false" || q.type === "scenario") {
    const ans = Array.isArray(q.answer) ? q.answer[0] : q.answer;
    const user = Array.isArray(userAns) ? userAns[0] : userAns;
    const ok = user === ans;
    return { awarded: ok ? q.points : 0, correct: ok };
  }

  if (q.type === "multi_select") {
    const expected = new Set((q.answer as string[]).map(String));
    const got = new Set(((userAns as string[]) ?? []).map(String));
    // Partial credit: per-choice F1-ish — we use Jaccard scaled to points.
    const intersect = [...expected].filter((c) => got.has(c)).length;
    const union = new Set([...expected, ...got]).size;
    const jaccard = union === 0 ? 0 : intersect / union;
    const awarded = Math.round(jaccard * q.points);
    return { awarded, correct: jaccard === 1 };
  }

  if (q.type === "code_fill_in") {
    const blanks = q.blanks ?? [];
    const userBlanks = Array.isArray(userAns) ? userAns : [userAns];
    let okCount = 0;
    for (let i = 0; i < blanks.length; i++) {
      const expected = (blanks[i] ?? "").trim().toLowerCase();
      const got = (userBlanks[i] ?? "").trim().toLowerCase();
      if (expected === got) okCount++;
    }
    const awarded = Math.round((okCount / Math.max(1, blanks.length)) * q.points);
    return { awarded, correct: okCount === blanks.length };
  }

  if (q.type === "short_answer") {
    const expected = String(Array.isArray(q.answer) ? q.answer[0] : q.answer)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const got = String(Array.isArray(userAns) ? userAns[0] : userAns)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const ok = expected === got;
    return { awarded: ok ? q.points : 0, correct: ok };
  }

  return { awarded: 0, correct: false };
}

export { QuizQuestionSchema, QuizSchema, SubmissionSchema };
