import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit3, ExternalLink, Rocket } from "lucide-react";

import { getGeneratedFunnel } from "@/lib/funnels/generated-store";

import { FunnelPreviewClient } from "./FunnelPreviewClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Funnel preview | gofunnelai.com",
};

/**
 * Full-page preview route for any saved funnel. Loads the persisted
 * AutomatedFunnel out of the on-disk store, maps it to the renderer shape on
 * the server, and renders via FunnelPreviewRenderer.
 *
 * `[id]` accepts either the funnel id or the slug.
 */
export default function FunnelPreviewPage({ params }: { params: { id: string } }) {
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
              <h1 className="text-sm font-semibold text-slate-950">{funnel.industry} funnel</h1>
              <p className="text-xs text-slate-500">{funnel.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/funnels/${params.id}/edit`}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Link>
            <Link
              href={`/dashboard/funnels/${params.id}/launch`}
              className="inline-flex items-center gap-2 rounded-md bg-signal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-signal-700"
            >
              <Rocket className="h-3.5 w-3.5" />
              Launch
            </Link>
            <a
              href={funnel.public_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open live
            </a>
          </div>
        </div>
      </header>

      <FunnelPreviewClient funnel={funnel as any} dbFunnelId={params.id} mode="preview" />
    </main>
  );
}
