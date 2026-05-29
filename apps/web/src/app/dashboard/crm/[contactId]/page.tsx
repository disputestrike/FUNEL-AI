/**
 * Lead detail page — live view of a contact's RevTry call activity.
 *
 *   - Real-time call status indicator (polled every 2s; production swaps in
 *     a WebSocket subscription).
 *   - "Listen to call recording" button — fetches a 15-minute signed R2 URL
 *     from `/v1/voice-calls/{id}/recording` and opens it in a new tab.
 *   - Transcript view (paginated, lazy-loaded on tab change).
 *   - Voicemail playback (uses the same recording_url surface).
 *   - "Call again" button — POSTs to the API to re-enqueue a dial.
 *
 * Server component shell + client islands for the live status + actions.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallActivity } from "./CallActivity.client";
import { CallActionBar } from "./CallActionBar.client";

export const metadata: Metadata = {
  title: "Lead detail | gofunnelai.com",
};

interface PageProps {
  params: { contactId: string };
}

export default function ContactDetailPage({ params }: PageProps) {
  const contactId = params.contactId;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              Contact
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink-900">{contactId}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Live RevTry call activity + recordings + transcripts.
            </p>
          </div>
          <CallActionBar contactId={contactId} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Recent calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CallActivity contactId={contactId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>60-second SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                RevTry dials qualified leads within 60 seconds of form submission.
              </p>
              <p>
                Two-party-consent states (CA, IL, FL, MD, MA, MT, NV, NH, PA, WA, OR,
                CT, DE) auto-play a recording disclosure before the agent speaks.
              </p>
              <p className="text-xs text-slate-500">
                State quiet hours and DNC checks run before placement — blocked calls
                fall back to SMS + email.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
