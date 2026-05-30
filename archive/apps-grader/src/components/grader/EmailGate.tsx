"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface EmailGateProps {
  auditId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaptured: (payload: { pdf_url: string; preview_unlocked: boolean }) => void;
}

export function EmailGate({ auditId, open, onOpenChange, onCaptured }: EmailGateProps) {
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId, email, marketing_consent: consent }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Couldn't save your email — please retry.");
        setBusy(false);
        return;
      }
      const body = (await resp.json()) as { pdf_url: string; preview_unlocked: boolean };
      onCaptured(body);
      onOpenChange(false);
    } catch {
      setError("Network error — please retry.");
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl animate-slide-up focus:outline-none">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="font-display text-xl font-bold text-ink-900">
                Get the full PDF report
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-900/70">
                We&apos;ll email you the detailed breakdown plus 3 ready-to-ship fixes. Free, no spam.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 hover:bg-ink-50" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
              autoFocus
              aria-label="Email"
            />
            <label className="flex items-start gap-2 text-xs text-ink-900/60">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Send me the audit and occasional product updates. Unsubscribe anytime.
              </span>
            </label>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" disabled={busy} size="lg">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Email me the PDF"
              )}
            </Button>
          </form>
          <p className="mt-3 text-center text-[11px] text-ink-900/40">
            By submitting you agree to our Terms and Privacy Policy.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
