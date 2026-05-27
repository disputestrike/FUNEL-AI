"use client";

import * as React from "react";
import { toast } from "sonner";
import { setMockSession } from "@/lib/auth-cookie";
import { useRouter } from "next/navigation";

/**
 * Google + Apple SSO buttons.
 *
 * Stubbed: the real OAuth flow lands later. Clicking sets the
 * mock-auth-session cookie with a placeholder email and redirects.
 */
export function SsoButtons({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();

  const handle = (provider: "google" | "apple") => {
    toast.success("Signing you in…");
    setMockSession(`${provider}-user@gofunnelai.com`);
    router.push(redirectTo);
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => handle("google")}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-body-sm font-medium text-slate-900 transition-all duration-small ease-out-brand hover:bg-slate-50 hover:-translate-y-px"
      >
        <GoogleIcon />
        Google
      </button>
      <button
        type="button"
        onClick={() => handle("apple")}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-body-sm font-medium text-slate-900 transition-all duration-small ease-out-brand hover:bg-slate-50 hover:-translate-y-px"
      >
        <AppleIcon />
        Apple
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.46-.81 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.93v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.95H.93A9 9 0 0 0 0 9c0 1.45.35 2.83.93 4.05l3.04-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .93 4.95l3.04 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M17.05 12.04c-.03-2.9 2.37-4.3 2.48-4.36-1.36-1.98-3.47-2.25-4.21-2.28-1.78-.18-3.5 1.05-4.4 1.05-.92 0-2.31-1.03-3.81-1-1.95.03-3.78 1.14-4.79 2.88-2.07 3.58-.53 8.86 1.47 11.76.98 1.42 2.13 3.01 3.63 2.95 1.46-.06 2.01-.94 3.77-.94 1.75 0 2.25.94 3.79.91 1.57-.03 2.55-1.43 3.5-2.86 1.13-1.64 1.59-3.23 1.62-3.31-.04-.02-3.1-1.18-3.13-4.69zM14.21 3.67c.78-.95 1.31-2.27 1.17-3.6-1.13.05-2.5.76-3.31 1.7-.72.83-1.36 2.18-1.19 3.47 1.26.1 2.55-.64 3.33-1.57z" />
    </svg>
  );
}
