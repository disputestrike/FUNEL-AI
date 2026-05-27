"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SsoButtons } from "@/components/auth/SsoButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setMockSession } from "@/lib/auth-cookie";

/**
 * /signup — stubbed but fully functional UX.
 *
 * On submit, sets a 7-day `mock-auth-session` cookie, persists the email
 * to localStorage so the welcome screen can greet the user, and routes
 * them into the onboarding funnel.
 */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password required.");
      return;
    }
    setLoading(true);
    try {
      window.localStorage.setItem("mfa.email", email);
    } catch {
      // localStorage may be unavailable (private mode); not fatal.
    }
    setMockSession(email);
    toast.success("Account created.");
    router.push("/welcome");
  };

  return (
    <AuthShell
      title="Get your first customer in 60 seconds."
      subtitle="Free forever. No credit card."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
        >
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-caption uppercase tracking-wider text-slate-400">
          Or continue with
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <SsoButtons redirectTo="/welcome" />

      <p className="mt-6 text-caption text-slate-500">
        By signing up you agree to our{" "}
        <Link
          href="/legal/terms"
          className="text-signal-600 underline-offset-2 hover:underline"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/legal/privacy"
          className="text-signal-600 underline-offset-2 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-6 text-center text-body-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-signal-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
