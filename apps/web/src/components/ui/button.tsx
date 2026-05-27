"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Button — matches doc 22 §H spec.
 *
 *   primary    Favicon-style brand gradient, white text. 40px min height. radius-md.
 *   secondary  Transparent, slate-300 border, slate-900 text.
 *   tertiary   Transparent, no border, slate-700 text.
 *   destructive  error-500, white text.
 *
 * Loading: label fades, three-dot ellipsis replaces it (NOT a spinner).
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none",
    "rounded-md transition-all",
    "duration-small ease-out-brand",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:translate-y-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,#6817d2_0%,#d91a8f_48%,#ff7a00_100%)] text-white shadow-sm hover:brightness-110 hover:-translate-y-px hover:shadow-md font-semibold",
        secondary:
          "border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-50 hover:-translate-y-px",
        tertiary:
          "bg-transparent text-slate-700 hover:bg-slate-100",
        destructive:
          "bg-error-500 text-white hover:bg-error-600 hover:-translate-y-px hover:shadow-md font-semibold",
        ghost: "bg-transparent text-slate-900 hover:bg-slate-100",
        link: "bg-transparent text-signal-600 underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 px-3 text-body-sm",
        md: "h-10 px-4 text-body",
        lg: "h-12 px-6 text-body-lg",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1" aria-hidden>
            <span className="size-1.5 rounded-full bg-current animate-ellipsis-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-1.5 rounded-full bg-current animate-ellipsis-bounce" style={{ animationDelay: "200ms" }} />
            <span className="size-1.5 rounded-full bg-current animate-ellipsis-bounce" style={{ animationDelay: "400ms" }} />
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
