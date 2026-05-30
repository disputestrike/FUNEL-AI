/**
 * Launch funnel page — the publish flow.
 *
 * Server-side component:
 *   1. Loads the funnel (workspace-scoped).
 *   2. Loads the current publish status (if any).
 *   3. Renders the LaunchClient with that snapshot as initial data.
 *
 * The client component owns the interactive bits (slug availability check,
 * QR code rendering, copy buttons, the "Launch funnel" submit) and talks
 * to /api/publish/* and /api/domains/* for state changes.
 */
import { notFound, redirect } from "next/navigation";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";
import { LaunchClient } from "./LaunchClient.client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Launch funnel | GoFunnelAI",
};

interface PageProps {
  params: { id: string };
}

export default async function LaunchFunnelPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/dashboard");

  const funnel = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.funnel.findFirst({
      where: { id: params.id, deleted_at: null },
      include: { current_version: true },
    })
  );
  if (!funnel) notFound();

  const latestPublished = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.publishedFunnel.findFirst({
      where: { funnel_id: params.id },
      orderBy: { version: "desc" },
      include: {
        shortLinks: { where: { deleted_at: null }, orderBy: { created_at: "desc" }, take: 5 },
      },
    })
  );

  const customDomains = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.customDomain.findMany({
      where: { deleted_at: null, status: { not: "removed" } },
      orderBy: { created_at: "desc" },
    })
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wider text-indigo-600">Launch</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Launch {funnel.name}
        </h1>
        <p className="mt-2 text-slate-600">
          Pick your free GoFunnelAI URL, get a short link for SMS &amp; QR codes, and optionally
          connect a custom domain. Your funnel will be live within 5 seconds.
        </p>
      </header>

      <LaunchClient
        funnelId={funnel.id}
        funnelName={funnel.name}
        vertical={funnel.vertical ?? "funnel"}
        workspaceSlug={session.workspace.slug}
        workspacePlan={session.workspace.plan}
        initialPublished={
          latestPublished
            ? {
                slug: latestPublished.slug,
                subdomainUrl: latestPublished.subdomain_url,
                customUrl: latestPublished.custom_domain
                  ? `https://${latestPublished.custom_domain}`
                  : null,
                version: latestPublished.version,
                status: latestPublished.status,
                shortLinks: latestPublished.shortLinks.map((s) => ({
                  code: s.code,
                  url: `https://gofnl.co/${s.code}`,
                  vanity: s.vanity,
                  clickCount: Number(s.click_count),
                })),
                publishedAt: latestPublished.published_at.toISOString(),
              }
            : null
        }
        customDomains={customDomains.map((d) => ({
          id: d.id,
          hostname: d.hostname,
          status: d.status,
          sslStatus: d.ssl_status,
          verificationToken: d.verification_token,
        }))}
      />
    </main>
  );
}
