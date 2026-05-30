"use client";

import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/grader/utils";

export type StepState = "pending" | "active" | "done" | "failed";

export interface Step {
  id: string;
  label: string;
  state: StepState;
  hint?: string;
}

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="mx-auto flex w-full max-w-md flex-col gap-3">
      {steps.map((step) => (
        <li
          key={step.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-ink-100 bg-white px-4 py-3 transition",
            step.state === "active" && "border-brand-300 shadow-sm",
            step.state === "done" && "border-success/30 bg-success/5",
            step.state === "failed" && "border-danger/30 bg-danger/5",
          )}
        >
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              step.state === "pending" && "bg-ink-50 text-ink-900/40",
              step.state === "active" && "bg-brand-500 text-white",
              step.state === "done" && "bg-success text-white",
              step.state === "failed" && "bg-danger text-white",
            )}
          >
            {step.state === "active" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step.state === "done" ? (
              <Check className="h-4 w-4" />
            ) : (
              ""
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-ink-900">{step.label}</div>
            {step.hint && <div className="text-xs text-ink-900/50">{step.hint}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
