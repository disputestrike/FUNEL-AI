import { redirect } from "next/navigation";
import { withWorkspace, getDashboardSession } from "@/lib/data";

/**
 * Workspace members + invite form. Invites are sent via @funnel/email,
 * carrying a signed workspace token so the recipient can join without
 * having to know the workspace slug.
 */
export const metadata = { title: "Team | Settings | GoFunnelAI" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/team");

  const members = await withWorkspace((tx) =>
    tx.workspaceMember.findMany({
      where: { removedAt: null },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  );

  const isOwnerOrAdmin = session.role === "owner" || session.role === "admin";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h4 font-semibold text-slate-900">Team</h2>
            <p className="mt-1 text-body-sm text-slate-500">
              People with access to {session.workspaceName}.
            </p>
          </div>
          {isOwnerOrAdmin && (
            <form action="/api/team/invite" method="post" className="flex gap-2">
              <input
                type="email"
                name="email"
                placeholder="teammate@business.com"
                className="rounded-md border border-slate-200 px-3 py-2 text-body-sm"
                required
              />
              <select
                name="role"
                className="rounded-md border border-slate-200 px-3 py-2 text-body-sm"
                defaultValue="editor"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
                <option value="billing">Billing</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-signal-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-signal-700"
              >
                Invite
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-slate-50 text-caption uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {m.user.name ?? m.user.email}
                    </div>
                    <div className="text-caption text-slate-500">
                      {m.user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-caption font-medium text-slate-700">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.joinedAt
                      ? new Date(m.joinedAt).toLocaleDateString()
                      : "Pending"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.lastSeenAt
                      ? new Date(m.lastSeenAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
