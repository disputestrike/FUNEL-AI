/**
 * Settings → Custom Domains.
 *
 * Server component:
 *   1. Auth-gates.
 *   2. Loads the workspace's custom domains (active + pending).
 *   3. Renders the interactive DomainsClient with that snapshot.
 *
 * The client component owns add/verify/remove + live SSL polling.
 */
import { redirect } from "next/navigation";
import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";
import { DomainsClient } from "./DomainsClient.client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Custom domains | GoFunnelAI",
};

export default async function DomainsSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/dashboard/settings/domains");

  const rows = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.customDomain.findMany({
      where: { deleted_at: null, status: { not: "removed" } },
      orderBy: { created_at: "desc" },
    })
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wider text-indigo-600">Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Custom domains</h1>
        <p className="mt-2 text-slate-600">
          Use your own domains (like getfreequote.com) for your funnels. SSL is issued automatically.
          Available on Growth tier and above.
        </p>
      </header>

      <DomainsClient
        plan={session.workspace.plan}
        initialDomains={rows.map((d) => ({
          id: d.id,
          hostname: d.hostname,
          status: d.status,
          ssl_status: d.ssl_status,
          verification_token: d.verification_token,
          verified_at: d.verified_at ? d.verified_at.toISOString() : null,
          activated_at: d.activated_at ? d.activated_at.toISOString() : null,
          failure_reason: d.failure_reason,
        }))}
      />
    </main>
  );
}
