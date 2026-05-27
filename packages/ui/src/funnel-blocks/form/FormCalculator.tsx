import * as React from "react";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Slider } from "../../primitives/slider";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm, UUID } from "../types";
import { AB } from "../types";

/**
 * form.calculator — Inputs produce a dynamic estimate.
 * Doc 18 B.2.5. Disclaimer required; Compliance Agent blocks publish if missing.
 *
 * The estimate_formula.expression is evaluated by a safe evaluator on the host
 * (NOT eval). We accept a `computeEstimate` prop instead of executing a string
 * here — security boundary stays outside the UI library.
 */
export interface FormCalculatorContent {
  form_id: FormId;
  headline?: string;
  inputs: { field_id: UUID; min: number; max: number; step: number; unit?: string }[];
  estimate_formula: {
    expression: string;
    rounding: "none" | "nearest_10" | "nearest_100" | "nearest_1000";
    currency_symbol?: string;
    disclaimer: string;
  };
  reveal_strategy: "always_visible" | "after_email";
}

export type FormCalculatorVariant = "live-calculation" | "submit-to-reveal";

export interface FormCalculatorProps extends BlockBaseProps {
  content: FormCalculatorContent;
  variant?: FormCalculatorVariant;
  /** Host-supplied evaluator. Receives field values keyed by `field.name`. */
  computeEstimate?: (values: Record<string, number>) => number;
  onSubmit?: (form: ResolvedForm, values: Record<string, number>, estimate: number) => void;
}

function round(value: number, mode: FormCalculatorContent["estimate_formula"]["rounding"]): number {
  switch (mode) {
    case "nearest_10":
      return Math.round(value / 10) * 10;
    case "nearest_100":
      return Math.round(value / 100) * 100;
    case "nearest_1000":
      return Math.round(value / 1000) * 1000;
    default:
      return value;
  }
}

export function FormCalculator({
  content,
  variant = "live-calculation",
  sectionId,
  resolveForm,
  styleOverrides,
  computeEstimate,
  onSubmit,
}: FormCalculatorProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const fieldsById = React.useMemo(() => new Map(form?.fields.map((f) => [f.id, f])), [form]);

  const initial = React.useMemo(() => {
    const init: Record<string, number> = {};
    for (const input of content.inputs) {
      const field = fieldsById.get(input.field_id);
      if (field) init[field.name] = Number(field.default_value ?? input.min);
    }
    return init;
  }, [content.inputs, fieldsById]);

  const [values, setValues] = React.useState<Record<string, number>>(initial);
  const [revealed, setRevealed] = React.useState(variant === "live-calculation" && content.reveal_strategy === "always_visible");
  const [email, setEmail] = React.useState("");

  // Debounce estimate updates for screen reader courtesy (1s per doc 18 B.2.5).
  const [debouncedValues, setDebouncedValues] = React.useState(values);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedValues(values), 250);
    return () => window.clearTimeout(id);
  }, [values]);
  const estimate = round(computeEstimate?.(debouncedValues) ?? 0, content.estimate_formula.rounding);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRevealed(true);
    if (form) onSubmit?.(form, values, estimate);
  };

  return (
    <BlockShell sectionId={sectionId} sectionType="form.calculator" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto grid max-w-marketing grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
        <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-xl border border-slate-200 bg-card p-6 md:p-8">
          {content.headline && (
            <h2 className="font-display text-h3 font-semibold text-slate-900" {...AB("calc-headline")}>
              {content.headline}
            </h2>
          )}
          {content.inputs.map((input) => {
            const field = fieldsById.get(input.field_id);
            if (!field) return null;
            return (
              <div key={field.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`${sectionId}-${field.name}`}>{field.label}</Label>
                  <span className="text-body-sm font-medium tnum text-slate-700">
                    {values[field.name]?.toLocaleString() ?? input.min}
                    {input.unit ? ` ${input.unit}` : ""}
                  </span>
                </div>
                <Slider
                  id={`${sectionId}-${field.name}`}
                  min={input.min}
                  max={input.max}
                  step={input.step}
                  value={[values[field.name] ?? input.min]}
                  onValueChange={([v]) =>
                    setValues((prev) => ({ ...prev, [field.name]: v ?? input.min }))
                  }
                  aria-valuetext={`${values[field.name]} ${input.unit ?? ""}`}
                />
              </div>
            );
          })}
          {variant === "submit-to-reveal" && !revealed && (
            <div className="space-y-2">
              <Label htmlFor={`${sectionId}-email`}>Email to see your estimate</Label>
              <Input
                id={`${sectionId}-email`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          {variant === "submit-to-reveal" && !revealed && (
            <Button type="submit" variant="primary" size="lg" fullWidth {...AB("calc-cta")}>
              Show me my estimate
            </Button>
          )}
        </form>
        <aside
          className="space-y-4 rounded-xl border border-signal-100 bg-signal-50 p-6 md:p-8"
          aria-live="polite"
        >
          <p className="text-caption font-medium uppercase tracking-wider text-signal-600">Your estimate</p>
          <p className="font-display text-display-2 font-semibold tnum text-slate-900">
            {revealed ? `${content.estimate_formula.currency_symbol ?? ""}${estimate.toLocaleString()}` : "—"}
          </p>
          <p className="text-caption text-slate-600">{content.estimate_formula.disclaimer}</p>
        </aside>
      </div>
    </BlockShell>
  );
}
