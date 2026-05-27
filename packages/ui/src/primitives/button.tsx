import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Button — shadcn-style, doc 22 PART H.
 *
 * Variants follow the brand: primary signal-500 solid, secondary outlined,
 * tertiary text-only, destructive error-500 solid, ghost transparent, link.
 *
 * No spinner loading state per doc 22; loading uses an inline 3-dot pattern
 * with 200ms stagger (`<LoadingDots />`).
 *
 * Text is weight 600, sentence case enforced by editorial review, not code.
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-md text-body-sm font-semibold",
    "transition-all duration-small ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:translate-y-0",
    "hover:-translate-y-px",
  ),
  {
    variants: {
      variant: {
        primary: cn(
          "bg-signal-500 text-white shadow-sm",
          "hover:bg-signal-600 hover:shadow-md",
          "active:bg-signal-700 active:shadow-sm",
        ),
        secondary: cn(
          "border border-slate-300 bg-transparent text-slate-900",
          "hover:bg-slate-100 hover:border-slate-400",
          "active:bg-slate-200",
          "dark:text-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
        ),
        tertiary: cn(
          "bg-transparent text-slate-700",
          "hover:bg-slate-100 hover:text-slate-900",
          "active:bg-slate-200",
          "dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
        ),
        destructive: cn(
          "bg-error-500 text-white shadow-sm",
          "hover:bg-error-600 hover:shadow-md",
        ),
        ghost: cn(
          "bg-transparent text-slate-900",
          "hover:bg-slate-100",
          "dark:text-slate-50 dark:hover:bg-slate-800",
        ),
        link: cn(
          "bg-transparent text-signal-600 underline-offset-4",
          "hover:underline hover:text-signal-700",
          "hover:translate-y-0",
        ),
      },
      size: {
        sm: "h-9 px-3 text-body-sm",
        md: "h-10 px-4 text-body-sm",
        lg: "h-11 px-6 text-body",
        xl: "h-12 px-8 text-body-lg",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <LoadingDots /> : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

/**
 * Three dots, 200ms stagger. The button-loading exception to the
 * "skeleton, never spinner" rule (doc 22 PART H — Loading states).
 */
function LoadingDots(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      <span className="size-1.5 animate-dot-pulse rounded-full bg-current" />
      <span className="size-1.5 animate-dot-pulse rounded-full bg-current [animation-delay:200ms]" />
      <span className="size-1.5 animate-dot-pulse rounded-full bg-current [animation-delay:400ms]" />
    </span>
  );
}

export { buttonVariants };
