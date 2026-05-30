import { redirect } from "next/navigation";
import { withWorkspace, getDashboardSession } from "@/lib/data";

export const metadata = { title: "API keys | Settings | GoFunnelAI" };
export const dynamic = "force-dynamic";

export default async function ApiKeysSettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/api-keys");

  const keys = await withWorkspace((tx) =>
    tx.apiKey.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h4 font-semibold text-slate-900">API keys</h2>
            <p className="mt-1 text-body-sm text-slate-500">
              Programmatic access to the GoFunnelAI API. Keys are shown once,
              hashed at rest, scoped to this workspace.
            </p>
          </div>
          <form action="/api/auth/api-keys" method="post">
            <input type="hidden" name="workspace_id" value={session.workspaceId} />
            <button
              type="submit"
              className="rounded-md bg-signal-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-signal-700"
            >
              Generate key
            </button>
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-slate-50 text-caption uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Prefix</th>
                <th className="px-4 py-2">Last used</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-body-sm text-slate-500"
                  >
                    No keys yet. Generate one to integrate with Zapier, n8n, or
                    a custom service.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {k.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-caption text-slate-700">
                      {k.keyPrefix}…
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleDateString()
                        : "never"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={`/api/auth/api-keys/${k.id}/revoke`}
                        method="post"
                      >
                        <button
                          type="submit"
                          className="text-caption font-medium text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
