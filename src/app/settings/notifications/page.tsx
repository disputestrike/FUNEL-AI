import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/data";

export const metadata = { title: "Notifications | Settings | GoFunnelAI" };
export const dynamic = "force-dynamic";

const CHANNELS = ["Email", "SMS", "In-app", "Slack"] as const;
const EVENTS = [
  { key: "lead.captured", label: "New lead captured" },
  { key: "lead.qualified", label: "Lead qualified by RevTry" },
  { key: "booking.confirmed", label: "Booking confirmed" },
  { key: "booking.canceled", label: "Booking canceled" },
  { key: "campaign.rejected", label: "Ad rejected by platform" },
  { key: "billing.limit_warning", label: "Usage approaching limit" },
  { key: "billing.payment_failed", label: "Payment failed" },
] as const;

export default async function NotificationsSettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/notifications");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-h4 font-semibold text-slate-900">Notifications</h2>
      <p className="mt-1 text-body-sm text-slate-500">
        Pick which channels fire for which events. Defaults are tuned for solo
        operators — review them before you scale your team.
      </p>

      <form action="/api/auth/notification-prefs" method="post" className="mt-6">
        <input type="hidden" name="workspace_id" value={session.workspaceId} />
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-slate-50 text-caption uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Event</th>
                {CHANNELS.map((ch) => (
                  <th key={ch} className="px-4 py-2 text-center">
                    {ch}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((event) => (
                <tr key={event.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {event.label}
                  </td>
                  {CHANNELS.map((ch) => (
                    <td key={ch} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        name={`${event.key}.${ch.toLowerCase()}`}
                        defaultChecked={ch === "Email" || ch === "In-app"}
                        className="size-4 rounded border-slate-300 text-signal-600 focus:ring-signal-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-signal-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-signal-700"
          >
            Save preferences
          </button>
        </div>
      </form>
    </div>
  );
}
