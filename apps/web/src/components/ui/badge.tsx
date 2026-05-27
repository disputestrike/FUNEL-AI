import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-caption font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-700",
        signal: "bg-signal-100 text-signal-700",
        ember: "bg-ember-100 text-ember-700",
        aqua: "bg-aqua-100 text-aqua-700",
        success: "bg-success-500/10 text-success-600",
        warning: "bg-warning-500/10 text-warning-600",
        error: "bg-error-500/10 text-error-600",
        info: "bg-info-500/10 text-info-600",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
