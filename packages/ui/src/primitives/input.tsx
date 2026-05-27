import * as React from "react";
import { cn } from "../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * Input — doc 22 PART H Form fields.
 * Min height 40px, slate-200 border, signal-500 focus ring.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", invalid, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";
    return (
      <input
        type={type}
        ref={ref}
        aria-invalid={isInvalid || undefined}
        className={cn(
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-body",
          "text-slate-900 dark:text-slate-50",
          "border-slate-200 dark:border-slate-700",
          "placeholder:text-slate-400",
          "transition-colors duration-small ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:border-slate-300",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-body-sm file:font-medium",
          isInvalid && "border-error-500 focus-visible:ring-error-500",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
