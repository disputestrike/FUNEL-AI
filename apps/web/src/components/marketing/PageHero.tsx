import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Reusable marketing page hero used by the smaller marketing routes
 * (help, blog, community, careers, press, etc).
 *
 * Doesn't replace HomeHero — that's the bigger animated one.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hero-gradient py-20 lg:py-28", className)}>
      <div className="container max-w-3xl text-center">
        {eyebrow && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-signal-200 bg-signal-50 px-3 py-1 text-caption font-semibold text-signal-700">
            <span className="size-1.5 rounded-full bg-signal-500" />
            {eyebrow}
          </div>
        )}
        <h1 className="text-h1 lg:text-display-2 font-display text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-6 text-body-lg text-slate-600 dark:text-slate-300">{subtitle}</p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
