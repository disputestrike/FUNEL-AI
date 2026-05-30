"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { GoogleG } from "@/components/auth/GoogleG";

/**
 * Activation card for /signup. Hosts the email/password create-account
 * form and the "Continue with Google" CTA. Routes through /welcome on
 * success so the user sees the onboarding mode tiles before the dashboard.
 */
export function SignupCard() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/welcome";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "Could not create account.");
        setSubmitting(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError(
          "Account created — but sign-in failed. Try signing in from the login page.",
        );
        setSubmitting(false);
        return;
      }
      window.location.href = result?.url ?? callbackUrl;
    } catch {
      setError("Could not create account. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(216,26,143,0.10),_transparent_55%)]"
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
            Get your first customer in 60 seconds.
          </h1>
          <p className="mt-2 text-body-sm text-slate-500">
            Free forever. No credit card.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label
                htmlFor="name"
                className="block text-caption font-medium text-slate-700"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-body text-slate-900 shadow-sm focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-caption font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-body text-slate-900 shadow-sm focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-caption font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-body text-slate-900 shadow-sm focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
              />
              <p className="mt-1 text-caption text-slate-500">
                At least 8 characters.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-caption text-rose-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal-600 px-4 py-3 text-body font-semibold text-white shadow-sm transition hover:bg-signal-700 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-caption text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="inline-flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-body font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-signal-500 focus:ring-offset-2"
          >
            <GoogleG />
            <span>Continue with Google</span>
          </button>

          <p className="mt-6 text-center text-caption text-slate-500">
            By signing up you agree to our{" "}
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
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-signal-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
