import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm } from "../types";
import { AB } from "../types";
import { FormFieldRenderer } from "./FormFieldRenderer";

/**
 * form.classic-3-field — Name + email + phone. The workhorse.
 * Doc 18 B.2.2.
 */
export interface FormClassic3FieldContent {
  form_id: FormId;
  headline?: string;
  subhead?: string;
  consent_copy_override?: string;
  show_phone_optional?: boolean;
}

export type FormClassic3FieldVariant = "card-floating" | "inline" | "dark-on-light" | "light-on-dark";

export interface FormClassic3FieldProps extends BlockBaseProps {
  content: FormClassic3FieldContent;
  variant?: FormClassic3FieldVariant;
  onSubmit?: (form: ResolvedForm, values: Record<string, string>) => void;
}

export function FormClassic3Field({
  content,
  variant = "card-floating",
  sectionId,
  resolveForm,
  styleOverrides,
  onSubmit,
}: FormClassic3FieldProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const dark = variant === "light-on-dark";

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form) onSubmit?.(form, values);
  };

  return (
    <BlockShell sectionId={sectionId} sectionType="form.classic-3-field" styleOverrides={styleOverrides} className={cn(dark ? "bg-slate-900" : "bg-signal-50")}>
      <div className={cn("mx-auto", variant === "card-floating" ? "max-w-md rounded-xl bg-card p-8 shadow-lg" : "max-w-lg", dark && variant !== "card-floating" && "text-slate-50")}>
        {content.headline && (
          <h2 className={cn("font-display text-h3 font-semibold", dark ? "text-slate-50" : "text-slate-900")} {...AB("form-headline")}>
            {content.headline}
          </h2>
        )}
        {content.subhead && <p className={cn("mt-2 text-body-sm", dark ? "text-slate-300" : "text-slate-700")}>{content.subhead}</p>}
        <form onSubmit={handle} noValidate className="mt-6 space-y-4">
          {form?.fields.map((field) => (
            <FormFieldRenderer
              key={field.id}
              field={field}
              value={values[field.name]}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
            />
          ))}
          {(form?.consent_capture?.tcpa_required || content.consent_copy_override) && (
            <p className={cn("text-caption", dark ? "text-slate-400" : "text-slate-500")}>
              {content.consent_copy_override ?? form?.consent_capture?.tcpa_copy}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" fullWidth {...AB("form-cta")}>
            Submit
          </Button>
        </form>
      </div>
    </BlockShell>
  );
}
