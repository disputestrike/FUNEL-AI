"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/grader/ui/Button";
import { Input } from "@/components/grader/ui/Input";
import { describeValidationError, InvalidAuditUrlError, validateAuditUrl } from "@/lib/grader/url-validation";

interface SubmitResponse {
  audit_id: string;
  share_code: string;
  status: string;
  cached?: boolean;
}

interface UrlFormProps {
  turnstileSitekey?: string | null;
}

export function UrlForm({ turnstileSitekey }: UrlFormProps) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);

  // Client-side validate before round-trip.
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (trimmed === "") {
      setError("Paste any landing-page URL to start.");
      return;
    }

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      validateAuditUrl(candidate);
    } catch (err) {
      if (err instanceof InvalidAuditUrlError) {
        setError(describeValidationError(err.reason));
      } else {
        setError("That URL doesn't look right.");
      }
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: candidate,
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      const data = (await resp.json()) as SubmitResponse;
      router.push(`/grade/audit/${data.audit_id}`);
    } catch (err) {
      setError("Couldn't reach the audit service. Check your connection and retry.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-3" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste any landing-page URL — https://yourpage.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={submitting}
          aria-label="URL to audit"
          aria-invalid={error !== null}
          className="h-14 text-base"
        />
        <Button type="submit" size="xl" disabled={submitting} className="shrink-0">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Auditing…
            </>
          ) : (
            <>
              Audit my funnel — free
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {turnstileSitekey && (
        <div
          className="cf-turnstile"
          data-sitekey={turnstileSitekey}
          data-callback="onTurnstileSuccess"
          data-size="invisible"
          aria-hidden
        />
      )}
      <p className="text-center text-xs text-ink-900/50">
        15-second AI audit. No signup to see your score.
      </p>
      {turnstileSitekey && (
        // Cloudflare Turnstile loader; window callback wires the token.
        <script
          dangerouslySetInnerHTML={{
            __html: `window.onTurnstileSuccess=function(t){window.__turnstileToken=t;};`,
          }}
        />
      )}
      {turnstileSitekey && (
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      )}
    </form>
  );
}
