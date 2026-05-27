import * as React from "react";
import { AlertOctagon } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";

/**
 * ErrorState — what failed, why, what to do, contact link.
 * Doc 22 PART B Error messages: "Name what broke. Avoid 'Something went wrong.'"
 */
export interface ErrorStateProps {
  /** What broke. */
  headline: string;
  /** Why it broke, plain language. Avoid stack traces; explain instead. */
  body?: string;
  /** What the user can do next. */
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  /** Where to get help. */
  contact?: { label: string; href: string };
  className?: string;
  /** Optional technical detail revealed inside a <details>, for paste-to-support. */
  detail?: string;
}

export function ErrorState({ headline, body, primaryAction, contact, className, detail }: ErrorStateProps): JSX.Element {
  return (
    <div className={cn("mx-auto flex max-w-prose flex-col items-start gap-4 rounded-lg border border-error-500/30 bg-error-500/5 p-6", className)} role="alert">
      <div className="flex items-center gap-2 text-error-600">
        <AlertOctagon aria-hidden="true" className="h-5 w-5" />
        <span className="text-caption font-semibold uppercase tracking-wider">Error</span>
      </div>
      <h3 className="text-h4 font-semibold text-slate-900 dark:text-slate-50">{headline}</h3>
      {body && <p className="text-body text-slate-700 dark:text-slate-300">{body}</p>}
      {detail && (
        <details className="text-body-sm text-slate-500">
          <summary className="cursor-pointer underline-offset-4 hover:underline">Show technical detail</summary>
          <pre className="mt-2 max-w-full overflow-x-auto rounded bg-slate-100 p-3 font-mono text-caption dark:bg-slate-800">{detail}</pre>
        </details>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {primaryAction && (
          <Button variant="primary" onClick={primaryAction.onClick} asChild={Boolean(primaryAction.href)}>
            {primaryAction.href ? <a href={primaryAction.href}>{primaryAction.label}</a> : primaryAction.label}
          </Button>
        )}
        {contact && (
          <a href={contact.href} className="text-body-sm text-signal-600 underline-offset-4 hover:underline">
            {contact.label}
          </a>
        )}
      </div>
    </div>
  );
}
