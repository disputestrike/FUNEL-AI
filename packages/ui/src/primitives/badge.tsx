import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  cn(
    "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-caption font-medium",
    "transition-colors duration-small ease-out",
  ),
  {
    variants: {
      variant: {
        default: "border-transparent bg-signal-100 text-signal-700 dark:bg-signal-900 dark:text-signal-200",
        neutral: "border-slate-200 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        success: "border-transparent bg-success-500/12 text-success-600",
        warning: "border-transparent bg-warning-500/12 text-warning-600",
        error: "border-transparent bg-error-500/12 text-error-600",
        info: "border-transparent bg-info-500/12 text-info-600",
        ember: "border-transparent bg-ember-100 text-ember-700",
        outline: "border-slate-300 text-slate-700 dark:text-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
