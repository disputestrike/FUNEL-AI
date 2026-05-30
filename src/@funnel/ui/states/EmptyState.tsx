import * as React from "react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";

/**
 * EmptyState — doc 22 PART H. Structure:
 *   1. Illustration (~120px tall, geometric, brand-color led).
 *   2. Headline (H4, weight 600, slate-900).
 *   3. Body (one or two sentences, slate-600).
 *   4. Primary CTA.
 *   5. Secondary action (tertiary button or text link).
 *
 * "Never show an empty state without a clear next action."
 */
export interface EmptyStateProps {
  /** Optional illustration. If omitted, a default geometric mark renders. */
  illustration?: React.ReactNode;
  headline: string;
  body?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({ illustration, headline, body, primaryAction, secondaryAction, className }: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-[480px] flex-col items-center text-center",
        "py-12",
        className,
      )}
      role="status"
    >
      <div className="mb-8" aria-hidden="true">
        {illustration ?? <DefaultIllustration />}
      </div>
      <h3 className="text-h4 font-semibold text-slate-900 dark:text-slate-50">{headline}</h3>
      {body && <p className="mt-4 text-body text-slate-600 dark:text-slate-400">{body}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {primaryAction && (
            <Button
              variant="primary"
              size="lg"
              onClick={primaryAction.onClick}
              asChild={Boolean(primaryAction.href)}
            >
              {primaryAction.href ? <a href={primaryAction.href}>{primaryAction.label}</a> : primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="tertiary"
              size="lg"
              onClick={secondaryAction.onClick}
              asChild={Boolean(secondaryAction.href)}
            >
              {secondaryAction.href ? <a href={secondaryAction.href}>{secondaryAction.label}</a> : secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Default illustration — a path narrowing toward a focal point.
 * Geometric, brand-color led, ~120px (doc 22 PART N example 3).
 */
function DefaultIllustration(): JSX.Element {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 24 L104 24 L80 64 L80 96 L40 96 L40 64 Z"
        stroke="currentColor"
        className="text-signal-500"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="60" cy="80" r="4" className="fill-signal-500" />
    </svg>
  );
}
