import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Skeleton — the only loading affordance allowed.
 *
 * No spinners (doc 22 PART H — "Skeleton screens, never spinners. This is a
 * hard rule."). Use `<Skeleton />` to mirror the shape of the content it
 * replaces; never use it to fill arbitrary space.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Disables the shimmer for users that prefer reduced motion. CSS handles
   * the global override; this prop forces it off per-instance. */
  static?: boolean;
}

export function Skeleton({ className, static: isStatic, ...props }: SkeletonProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("rounded-md bg-muted", !isStatic && "skeleton-shimmer", className)}
      {...props}
    />
  );
}

/** Common skeleton compositions. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }): JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-4/5" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-card p-6", className)}>
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
    </div>
  );
}
