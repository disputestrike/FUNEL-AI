"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-md border bg-white px-3 py-2.5 text-body",
        "placeholder:text-slate-400 text-slate-900",
        "transition-colors duration-small ease-out-brand",
        "focus:outline-none focus:ring-2 focus:ring-signal-500 focus:border-slate-300",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
        hasError ? "border-error-500" : "border-slate-200",
        "dark:bg-slate-900 dark:text-slate-50 dark:border-slate-700",
        className,
      )}
      aria-invalid={hasError || undefined}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
