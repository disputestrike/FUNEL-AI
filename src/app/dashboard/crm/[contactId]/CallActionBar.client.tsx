"use client";

/**
 * Manual-dial trigger for a contact. Calls the workspace tRPC `crm.dialLead`
 * mutation (or a placeholder POST in dev) and shows an inline "dialing"
 * confirmation while the queue picks up the job.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

export function CallActionBar({ contactId }: { contactId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function dial() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/crm/${encodeURIComponent(contactId)}/dial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual" }),
      });
      if (!res.ok) {
        setMessage("Dial failed — check phone number or consent.");
      } else {
        setMessage("Dialing… expect the call within 60 seconds.");
      }
    } catch {
      setMessage("Dial failed — network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={dial} loading={pending}>
        <Phone className="h-4 w-4" />
        Call again
      </Button>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
