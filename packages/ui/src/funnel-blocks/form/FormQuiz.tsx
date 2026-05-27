import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Progress } from "../../primitives/progress";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId, FormId, ResolvedForm } from "../types";
import { AB } from "../types";

/**
 * form.quiz — Multi-question quiz that reveals a result based on scoring.
 * Doc 18 B.2.6.
 */
export interface FormQuizQuestion {
  id: string;
  prompt: string;
  options: { value: string; label: string; score?: number }[];
}

export interface FormQuizResult {
  id: string;
  /** Minimum score (inclusive). */
  min_score: number;
  headline: string;
  body?: string;
  cta_id?: CTAId;
}

export interface FormQuizContent {
  form_id: FormId;
  headline?: string;
  questions: FormQuizQuestion[];
  results: FormQuizResult[];
}

export type FormQuizVariant = "one-question-per-screen" | "all-on-one-page";

export interface FormQuizProps extends BlockBaseProps {
  content: FormQuizContent;
  variant?: FormQuizVariant;
  onComplete?: (form: ResolvedForm | undefined, answers: Record<string, string>, result: FormQuizResult) => void;
}

export function FormQuiz({
  content,
  variant = "one-question-per-screen",
  sectionId,
  resolveForm,
  resolveCTA,
  styleOverrides,
  onComplete,
}: FormQuizProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [step, setStep] = React.useState(0);
  const total = content.questions.length;
  const finished = step >= total;

  const score = Object.entries(answers).reduce((acc, [qid, val]) => {
    const q = content.questions.find((qq) => qq.id === qid);
    const opt = q?.options.find((o) => o.value === val);
    return acc + (opt?.score ?? 0);
  }, 0);

  const result = React.useMemo(() => {
    const sorted = [...content.results].sort((a, b) => b.min_score - a.min_score);
    return sorted.find((r) => score >= r.min_score) ?? sorted[sorted.length - 1];
  }, [content.results, score]);

  React.useEffect(() => {
    if (finished && result) onComplete?.(form, answers, result);
  }, [finished, result, form, answers, onComplete]);

  const renderQuestion = (q: FormQuizQuestion, idx: number) => (
    <fieldset key={q.id} className="space-y-4">
      <legend className="font-display text-h3 font-semibold text-slate-900" {...AB(`quiz-q-${idx}`)}>
        {q.prompt}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {q.options.map((opt) => {
          const selected = answers[q.id] === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setAnswers((prev) => ({ ...prev, [q.id]: opt.value }));
                if (variant === "one-question-per-screen") setStep((s) => s + 1);
              }}
              className={cn(
                "rounded-lg border p-4 text-left text-body transition-colors duration-small ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-signal-500 bg-signal-50 text-slate-900"
                  : "border-slate-200 bg-card text-slate-700 hover:border-signal-300 hover:bg-signal-50",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <BlockShell sectionId={sectionId} sectionType="form.quiz" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-2xl">
        {content.headline && (
          <h2 className="mb-8 font-display text-h2 font-semibold text-slate-900" {...AB("quiz-headline")}>
            {content.headline}
          </h2>
        )}
        {!finished && variant === "one-question-per-screen" && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-card p-6 md:p-8">
            <Progress value={((step) / total) * 100} aria-label="Quiz progress" />
            <p className="text-caption text-slate-500 tnum">
              Question {step + 1} of {total}
            </p>
            {content.questions[step] && renderQuestion(content.questions[step]!, step)}
          </div>
        )}
        {!finished && variant === "all-on-one-page" && (
          <div className="space-y-8 rounded-xl border border-slate-200 bg-card p-6 md:p-8">
            {content.questions.map((q, i) => renderQuestion(q, i))}
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => setStep(total)}
              disabled={Object.keys(answers).length < total}
              {...AB("quiz-submit")}
            >
              Show my result
            </Button>
          </div>
        )}
        {finished && result && (
          <div className="rounded-xl border border-signal-200 bg-signal-50 p-6 text-center md:p-10" role="status">
            <h3 className="font-display text-h2 font-semibold text-slate-900">{result.headline}</h3>
            {result.body && <p className="mt-4 text-body text-slate-700">{result.body}</p>}
            {result.cta_id && (
              <div className="mt-6 flex justify-center">
                {(() => {
                  const cta = resolveCTA?.(result.cta_id!);
                  if (!cta) return null;
                  return (
                    <Button variant="primary" size="lg" asChild>
                      <a href={cta.action.link_url ?? "#"}>{cta.label}</a>
                    </Button>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </BlockShell>
  );
}
