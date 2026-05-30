import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Progress } from "../../primitives/progress";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm, UUID } from "../types";
import { AB } from "../types";
import { FormFieldRenderer } from "./FormFieldRenderer";

/**
 * form.multi-step — 3-step wizard.
 * Doc 18 B.2.4.
 */
export interface FormMultiStepContent {
  form_id: FormId;
  step_titles: string[];
  step_field_groups: UUID[][];
  progress_style?: "bar" | "dots" | "numbered_steps";
  allow_back_navigation?: boolean;
  per_step_cta_label?: string[];
}

export type FormMultiStepVariant = "progress-bar-top" | "step-tabs-top" | "card-deck";

export interface FormMultiStepProps extends BlockBaseProps {
  content: FormMultiStepContent;
  variant?: FormMultiStepVariant;
  onSubmit?: (form: ResolvedForm, values: Record<string, string>) => void;
}

export function FormMultiStep({
  content,
  sectionId,
  resolveForm,
  styleOverrides,
  onSubmit,
}: FormMultiStepProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const total = content.step_titles.length;
  const isLast = step >= total - 1;
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const currentFieldIds = content.step_field_groups[step] ?? [];
  const currentFields = form?.fields.filter((f) => currentFieldIds.includes(f.id)) ?? [];

  const next = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLast) {
      setStep((s) => Math.min(s + 1, total - 1));
    } else if (form) {
      onSubmit?.(form, values);
    }
  };

  const stepLabel = content.per_step_cta_label?.[step] ?? (isLast ? "Submit" : "Next");

  return (
    <BlockShell sectionId={sectionId} sectionType="form.multi-step" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-2xl">
        {/* Progress indicator. */}
        <div className="mb-6">
          {content.progress_style === "dots" ? (
            <ol className="flex justify-center gap-2" aria-label="Form progress">
              {content.step_titles.map((_, i) => (
                <li
                  key={i}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "h-2 w-8 rounded-full",
                    i < step ? "bg-signal-500" : i === step ? "bg-signal-500" : "bg-slate-200",
                  )}
                />
              ))}
            </ol>
          ) : content.progress_style === "numbered_steps" ? (
            <ol className="flex items-center justify-center gap-3 text-caption text-slate-500" aria-label="Form progress">
              {content.step_titles.map((title, i) => (
                <li key={i} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold tnum",
                      i <= step ? "bg-signal-500 text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={cn("hidden md:inline", i === step && "text-slate-900 font-medium")}>{title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <>
              <Progress value={((step + 1) / total) * 100} aria-label="Form progress" />
              <p className="mt-2 text-center text-caption text-slate-500 tnum">
                Step {step + 1} of {total}
              </p>
            </>
          )}
        </div>
        <form onSubmit={next} noValidate className="rounded-xl border border-slate-200 bg-card p-6 shadow-md md:p-8" aria-live="polite">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-h3 font-semibold text-slate-900 outline-none"
            {...AB(`form-step-${step}-headline`)}
          >
            {content.step_titles[step]}
          </h2>
          <div className="mt-6 space-y-4">
            {currentFields.map((field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={values[field.name]}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
              />
            ))}
          </div>
          <div className="mt-8 flex items-center justify-between gap-3">
            {content.allow_back_navigation && step > 0 ? (
              <Button type="button" variant="tertiary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" variant="primary" {...AB(`form-step-${step}-cta`)}>
              {stepLabel}
            </Button>
          </div>
        </form>
      </div>
    </BlockShell>
  );
}
