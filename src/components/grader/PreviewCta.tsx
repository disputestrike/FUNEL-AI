"use client";

import { Sparkles, Lock, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/grader/ui/Button";

interface PreviewCtaProps {
  auditId: string;
  unlocked: boolean;
  onUnlock: () => void;
}

export function PreviewCta({ auditId, unlocked, onUnlock }: PreviewCtaProps) {
  const [busy, setBusy] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const generate = async () => {
    if (!unlocked) {
      onUnlock();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/preview/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId }),
      });
      if (!resp.ok) {
        setError("Couldn't generate preview right now. Try again in a moment.");
        setBusy(false);
        return;
      }
      const body = (await resp.json()) as { preview_url: string };
      setPreviewUrl(body.preview_url);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Sparkles className="h-4 w-4" />
            See what we&apos;d generate instead
          </div>
          <h3 className="mt-2 font-display text-xl font-bold text-ink-900">
            A complete replacement hero — built in 30 seconds.
          </h3>
          <p className="mt-2 text-sm text-ink-900/70">
            Watch our agents write a new headline, sub-headline, CTA, social-proof line, and trust badges tailored to your business. Then decide if you want the whole funnel.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={busy} size="lg">
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : unlocked ? (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate my preview
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Unlock preview
            </>
          )}
        </Button>
        {!unlocked && (
          <span className="text-xs text-ink-900/60">Email required (free).</span>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {previewUrl && (
        <div className="mt-6 overflow-hidden rounded-xl border border-ink-100">
          <iframe
            src={previewUrl}
            title="Preview funnel"
            className="h-[420px] w-full"
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
