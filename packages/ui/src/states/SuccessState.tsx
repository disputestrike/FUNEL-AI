import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";

/**
 * SuccessState — confirmation message + next-step CTA. Toasts for transient
 * success; this component is for committed page-level success surfaces (e.g.,
 * a thank-you page or in-form "submitted" state).
 *
 * Exclamation marks allowed sparingly (success only) per doc 22 PART A.
 * "First leads always feel different. Congrats on shipping." style.
 */
export interface SuccessStateProps {
  headline: string;
  body?: string;
  /** The next thing for the user to do. */
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

export function SuccessState({ headline, body, primaryAction, secondaryAction, className }: SuccessStateProps): JSX.Element {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-prose flex-col items-center gap-4 rounded-lg border border-success-500/30 bg-success-500/5 p-8 text-center",
        className,
      )}
      role="status"
    >
      <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-success-500" />
      <h3 className="text-h3 font-semibold text-slate-900 dark:text-slate-50">{headline}</h3>
      {body && <p className="text-body text-slate-700 dark:text-slate-300">{body}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          {primaryAction && (
            <Button variant="primary" size="lg" onClick={primaryAction.onClick} asChild={Boolean(primaryAction.href)}>
              {primaryAction.href ? <a href={primaryAction.href}>{primaryAction.label}</a> : primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="tertiary" size="lg" onClick={secondaryAction.onClick} asChild={Boolean(secondaryAction.href)}>
              {secondaryAction.href ? <a href={secondaryAction.href}>{secondaryAction.label}</a> : secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
