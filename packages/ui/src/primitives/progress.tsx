import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../lib/cn";

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  /** When unknown, we render an indeterminate striped fill — NOT a spinner. */
  indeterminate?: boolean;
}

export const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", className)}
      value={indeterminate ? undefined : value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 bg-signal-500 transition-transform duration-large ease-out",
          indeterminate && "animate-shimmer bg-[linear-gradient(100deg,theme(colors.signal.500)_0%,theme(colors.signal.400)_50%,theme(colors.signal.500)_100%)] bg-[length:200%_100%]",
        )}
        style={indeterminate ? undefined : { transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
      />
    </ProgressPrimitive.Root>
  ),
);
Progress.displayName = ProgressPrimitive.Root.displayName;
