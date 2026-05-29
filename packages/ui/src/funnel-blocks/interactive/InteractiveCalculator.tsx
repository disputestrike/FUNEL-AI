import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface CalcInput {
  name: string;
  label: string;
  default_value?: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export interface InteractiveCalculatorContent {
  headline?: string;
  subhead?: string;
  inputs: CalcInput[];
  /** Formula: math.js-style expression. Variables = input.name. */
  formula: string;
  result_label: string;
  result_format?: "currency" | "number" | "percent";
  result_currency?: string;
}

export interface InteractiveCalculatorProps extends BlockBaseProps {
  content: InteractiveCalculatorContent;
}

function evalSafe(formula: string, vars: Record<string, number>): number {
  // very narrow expression evaluator: digits, +-*/(), and variable names.
  const cleaned = formula.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (n) => String(vars[n] ?? 0));
  if (!/^[\d+\-*/(). ]+$/.test(cleaned)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict";return (${cleaned})`)() as number;
  } catch {
    return 0;
  }
}

function fmt(n: number, format: InteractiveCalculatorContent["result_format"], currency: string): string {
  try {
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    }
    if (format === "percent") {
      return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(n);
    }
    return new Intl.NumberFormat("en-US").format(n);
  } catch {
    return String(n);
  }
}

export function InteractiveCalculator({ content, sectionId, styleOverrides }: InteractiveCalculatorProps): JSX.Element {
  const [values, setValues] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(content.inputs.map((i) => [i.name, i.default_value ?? 0])),
  );
  const result = React.useMemo(() => evalSafe(content.formula, values), [content.formula, values]);

  return (
    <BlockShell sectionId={sectionId} sectionType="interactive.calculator" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
        {content.headline && <h2 className="text-center font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>}
        {content.subhead && <p className="mt-2 text-center text-body text-slate-600">{content.subhead}</p>}
        <div className="mt-8 space-y-6">
          {content.inputs.map((input) => (
            <div key={input.name}>
              <div className="mb-1 flex items-baseline justify-between">
                <label htmlFor={input.name} className="text-body-sm font-semibold text-slate-900">{input.label}</label>
                <span className="text-body-sm font-bold tabular-nums text-signal-700">
                  {values[input.name]} {input.suffix ?? ""}
                </span>
              </div>
              <input
                id={input.name}
                type="range"
                min={input.min ?? 0}
                max={input.max ?? 100}
                step={input.step ?? 1}
                value={values[input.name]}
                onChange={(e) => setValues((p) => ({ ...p, [input.name]: Number(e.target.value) }))}
                className="w-full accent-signal-600"
              />
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-xl bg-signal-50 p-6 text-center">
          <div className="text-caption font-semibold uppercase tracking-wider text-signal-700">{content.result_label}</div>
          <div className="mt-2 text-display-1 font-black text-signal-700 tabular-nums">
            {fmt(result, content.result_format, content.result_currency ?? "USD")}
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
