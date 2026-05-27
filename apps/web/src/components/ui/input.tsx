"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

/**
 * Input — matches doc 22 §H form-field spec.
 * 40px min height, 12px horiz / 10px vert padding, 1px slate-200 border.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border bg-white px-3 py-2.5 text-body",
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
Input.displayName = "Input";
