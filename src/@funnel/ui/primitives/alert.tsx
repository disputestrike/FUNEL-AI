import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Alert — inline notice. Always pairs color with an icon (doc 22 PART E).
 */
const alertVariants = cva(
  "relative w-full rounded-md border-l-4 p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        info: "border-info-500 bg-info-500/5 text-info-600",
        success: "border-success-500 bg-success-500/5 text-success-600",
        warning: "border-warning-500 bg-warning-500/5 text-warning-600",
        error: "border-error-500 bg-error-500/5 text-error-600",
        neutral: "border-slate-300 bg-slate-50 text-slate-700",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  neutral: Info,
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "info", icon, children, ...props }, ref) => {
  const Icon = iconMap[variant ?? "info"];
  return (
    <div ref={ref} role={variant === "error" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      {icon ?? <Icon aria-hidden="true" />}
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 text-body-sm font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-body-sm [&_p]:leading-relaxed", className)} {...props} />,
);
AlertDescription.displayName = "AlertDescription";
