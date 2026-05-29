import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Sparkles } from "lucide-react";

import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

import { FunnelPreviewClient } from "../preview/FunnelPreviewClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit funnel | gofunnelai.com",
};

/**
 * AI-guided edit mode for a saved funnel. Each section is clickable; clicking
 * opens the SectionEditDialog with quick-action buttons and a freeform
 * instruction box that posts to the regeneration endpoint.
 */
export default function FunnelEditPage({ params }: { params: { id: string } }) {
  const funnel = getGeneratedFunnel(params.id);
  if (!funnel) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-marketing items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h1 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Sparkles className="h-4 w-4 text-signal-600" />
                Editing: {funnel.industry}
              </h1>
              <p className="text-xs text-slate-500">Hover any section to edit. Click for AI options.</p>
            </div>
          </div>
          <Link
            href={`/dashboard/funnels/${params.id}/preview`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Link>
        </div>
      </header>

      <FunnelPreviewClient funnel={funnel as any} dbFunnelId={params.id} mode="edit" />
    </main>
  );
}
