"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** /forgot-password — stubbed reset flow. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email.");
      return;
    }
    setSent(true);
    toast.success("Check your inbox for a reset link.");
  };

  return (
    <AuthShell
      title="Reset your password."
      subtitle="We'll email you a link. Takes 30 seconds."
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-body text-slate-700">
            If an account exists for{" "}
            <span className="font-medium text-slate-900">{email}</span>, you'll
            get a reset link within a minute.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-body-sm font-medium text-signal-600 hover:underline"
          >
            Back to sign in <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
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
          <Button type="submit" size="lg" className="w-full">
            Send reset link <ArrowRight className="size-4" />
          </Button>
          <p className="text-center text-body-sm text-slate-600">
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-medium text-signal-600 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
