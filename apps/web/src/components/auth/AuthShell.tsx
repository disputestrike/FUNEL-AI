import * as React from "react";
import Link from "next/link";
import { Lockup } from "@/components/brand/Wordmark";

/**
 * Centered single-card layout for /signup, /login, /forgot-password.
 *
 * Mobile-first: full-width card with breathable padding on small screens,
 * caps to ~448px on tablet+.
 */
export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* Subtle gradient backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(217,26,143,0.12),_transparent_55%)]"
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link
          href="/"
          aria-label="GoFunnelAI home"
          className="mb-8 inline-flex items-center"
        >
          <Lockup height={40} />
        </Link>

        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <h1 className="text-h3 font-display text-slate-900 sm:text-h2">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-body-sm text-slate-500 sm:text-body">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-6 text-center text-caption text-slate-500">
          Trusted by operators in 30 industries.
        </p>
      </div>
    </div>
  );
}
