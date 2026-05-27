import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm } from "../types";
import { AB } from "../types";

/**
 * form.inline-single-field — Just email. List building.
 * Doc 18 B.2.1.
 */
export interface FormInlineSingleFieldContent {
  form_id: FormId;
  headline?: string;
  microcopy?: string;
  cta_label_override?: string;
}

export type FormInlineSingleFieldVariant = "horizontal-pill" | "stacked" | "inline-with-text";

export interface FormInlineSingleFieldProps extends BlockBaseProps {
  content: FormInlineSingleFieldContent;
  variant?: FormInlineSingleFieldVariant;
  onSubmit?: (form: ResolvedForm, value: string) => void;
}

export function FormInlineSingleField({
  content,
  variant = "horizontal-pill",
  sectionId,
  resolveForm,
  styleOverrides,
  onSubmit,
}: FormInlineSingleFieldProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const emailField = form?.fields.find((f) => f.type === "email") ?? form?.fields[0];
  const [value, setValue] = React.useState("");
  const microId = React.useId();

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form) onSubmit?.(form, value);
  };

  return (
    <BlockShell sectionId={sectionId} sectionType="form.inline-single-field" styleOverrides={styleOverrides} className="bg-slate-100">
      <div className="mx-auto max-w-2xl text-center">
        {content.headline && (
          <h2 className="font-display text-h3 font-semibold text-slate-900 md:text-h2" {...AB("form-headline")}>
            {content.headline}
          </h2>
        )}
        <form
          onSubmit={handle}
          className={cn(
            "mt-6 flex gap-3",
            variant === "stacked" ? "flex-col" : "flex-col sm:flex-row sm:items-stretch",
          )}
          noValidate
        >
          <Label htmlFor={`${sectionId}-email`} className="sr-only">
            {emailField?.label ?? "Email"}
          </Label>
          <Input
            id={`${sectionId}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={emailField?.placeholder ?? "you@email.com"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby={content.microcopy ? microId : undefined}
            className={cn(variant === "horizontal-pill" && "rounded-full")}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={cn(variant === "horizontal-pill" && "rounded-full")}
            {...AB("form-cta")}
          >
            {content.cta_label_override ?? "Subscribe"}
          </Button>
        </form>
        {content.microcopy && (
          <p id={microId} className="mt-3 text-caption text-slate-600">
            {content.microcopy}
          </p>
        )}
      </div>
    </BlockShell>
  );
}
