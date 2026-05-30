"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { GoogleG } from "@/components/auth/GoogleG";

/**
 * Client-side card for /login. Hosts the "Continue with Google" CTA and
 * reads `callbackUrl` off the query string so middleware-bounced visitors
 * land back on whatever they were trying to reach.
 */
export function LoginCard() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.10),_transparent_55%)]"
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link
          href="/"
          aria-label="GoFunnelAI home"
          className="mb-8 inline-flex items-center"
        >
          <Image
            src="/brand/logos/funelai_primary_logo.png"
            alt="GoFunnelAI"
            width={180}
            height={40}
            priority
          />
        </Link>

        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-h3 font-display font-semibold text-slate-900">
            Welcome back to GoFunnelAI
          </h1>
          <p className="mt-2 text-body-sm text-slate-500">
            Sign in to your workspace.
          </p>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-body font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:ring-offset-2"
          >
            <GoogleG />
            <span>Continue with Google</span>
          </button>

          <p className="mt-6 text-center text-caption text-slate-500">
            By signing in you agree to our{" "}
            <Link href="/legal/terms" className="underline hover:text-slate-700">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline hover:text-slate-700">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <p className="mt-6 text-body-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-signal-600 hover:underline">
            Sign up — it&apos;s free
          </Link>
        </p>
      </div>
    </div>
  );
}
