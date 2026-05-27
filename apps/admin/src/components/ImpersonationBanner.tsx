/**
 * Impersonation banner.
 *
 * This component renders WHEN an impersonation cookie is set. The same
 * impersonation_id is rendered in the customer-facing web app's banner
 * so the impersonated user also sees the red bar at the top of their
 * screen — non-negotiable per doc 12 PRD-5 §7.
 *
 * The "End impersonation" button posts to /api/impersonation/end which
 * clears the session and the cookie. It also writes the
 * `impersonation_ended` audit row + emits the event.
 */

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, X } from "lucide-react";

export function ImpersonationBanner({
  impersonationId,
}: {
  impersonationId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function end() {
    start(async () => {
      const res = await fetch("/api/impersonation/end", {
        method: "POST",
        body: JSON.stringify({ impersonation_id: impersonationId }),
        headers: { "content-type": "application/json" },
      });
      if (res.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="impersonation-bar flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4" />
        <span>
          IMPERSONATION ACTIVE — id{" "}
          <span className="font-mono">{impersonationId}</span> — every click is
          logged + visible to the customer.
        </span>
      </div>
      <button
        type="button"
        onClick={end}
        disabled={pending}
        className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-caption font-medium hover:bg-white/20 disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        {pending ? "Ending..." : "End impersonation"}
      </button>
    </div>
  );
}
