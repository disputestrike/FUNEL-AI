import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Progress } from "../../primitives/progress";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm } from "../types";
import { AB } from "../types";
import { FormFieldRenderer } from "./FormFieldRenderer";

/**
 * form.long-7-field — Full qualifying form for high-ticket B2B / contracting.
 * Doc 18 B.2.3.
 */
export interface FormLong7FieldContent {
  form_id: FormId;
  headline?: string;
  subhead?: string;
  progress_indicator?: boolean;
  trust_microcopy?: string;
}

export type FormLong7FieldVariant = "two-column" | "single-column" | "sectioned";

export interface FormLong7FieldProps extends BlockBaseProps {
  content: FormLong7FieldContent;
  variant?: FormLong7FieldVariant;
  onSubmit?: (form: ResolvedForm, values: Record<string, string>) => void;
}

export function FormLong7Field({
  content,
  variant = "two-column",
  sectionId,
  resolveForm,
  styleOverrides,
  onSubmit,
}: FormLong7FieldProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const filled = form ? form.fields.filter((f) => Boolean(values[f.name])).length : 0;
  const progress = form ? (filled / form.fields.length) * 100 : 0;

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form) onSubmit?.(form, values);
  };

  return (
    <BlockShell sectionId={sectionId} sectionType="form.long-7-field" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-3xl">
        {content.headline && (
          <h2 className="font-display text-h2 font-semibold text-slate-900" {...AB("form-headline")}>
            {content.headline}
          </h2>
        )}
        {content.subhead && <p className="mt-3 text-body text-slate-700">{content.subhead}</p>}
        {content.progress_indicator && (
          <div className="mt-6">
            <Progress value={progress} aria-label="Form progress" />
            <p className="mt-2 text-caption text-slate-500 tnum">
              {filled} of {form?.fields.length ?? 0} fields complete
            </p>
          </div>
        )}
        <form
          onSubmit={handle}
          noValidate
          className={cn(
            "mt-8 rounded-xl border border-slate-200 bg-card p-6 md:p-8",
            variant === "two-column" && "grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6",
            variant !== "two-column" && "space-y-5",
          )}
        >
          {form?.fields.map((f) => (
            <FormFieldRenderer
              key={f.id}
              field={f}
              value={values[f.name]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
            />
          ))}
          <div className={cn(variant === "two-column" && "md:col-span-2", "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between")}>
            {content.trust_microcopy && (
              <p className="flex items-center gap-1.5 text-caption text-slate-500">
                <Lock className="h-3.5 w-3.5" /> {content.trust_microcopy}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" {...AB("form-cta")}>
              Submit
            </Button>
          </div>
        </form>
      </div>
    </BlockShell>
  );
}
