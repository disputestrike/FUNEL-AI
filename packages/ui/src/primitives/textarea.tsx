import * as React from "react";
import { cn } from "../lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";
    return (
      <textarea
        ref={ref}
        aria-invalid={isInvalid || undefined}
        className={cn(
          "flex min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-body",
          "text-slate-900 dark:text-slate-50",
          "border-slate-200 dark:border-slate-700",
          "placeholder:text-slate-400",
          "transition-colors duration-small ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isInvalid && "border-error-500 focus-visible:ring-error-500",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
