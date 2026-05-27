"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SsoButtons } from "@/components/auth/SsoButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setMockSession } from "@/lib/auth-cookie";

/** /login — stubbed sign-in screen. Mirrors /signup visually. */
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

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
    setMockSession(email);
    toast.success("Welcome back.");
    router.push(next);
  };

  const sendMagicLink = () => {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    toast.success("Magic link sent. Check your inbox.");
  };

  return (
    <AuthShell
      title="Welcome back."
      subtitle="Pick up where you left off."
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-caption text-signal-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
        >
          Sign in <ArrowRight className="size-4" />
        </Button>
      </form>

      <button
        type="button"
        onClick={sendMagicLink}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-body-sm font-medium text-signal-600 hover:bg-signal-50"
      >
        Or sign in with a magic link
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-caption uppercase tracking-wider text-slate-400">
          Or continue with
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <SsoButtons redirectTo={next} />

      <p className="mt-6 text-center text-body-sm text-slate-600">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-signal-600 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
