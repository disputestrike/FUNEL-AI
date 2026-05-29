import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/site/Header";
import { getDashboardSession } from "@/lib/data";

const NAV = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/api-keys", label: "API keys" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDashboardSession();
  if (!session) redirect("/login?callbackUrl=/settings/profile");

  return (
    <>
      <Header />
      <main id="main" className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <p className="text-caption font-semibold uppercase tracking-wide text-signal-600">
              {session.workspaceName}
            </p>
            <h1 className="mt-1 text-h2 font-display font-semibold text-slate-900">
              Settings
            </h1>
          </div>
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <aside>
              <nav className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <ul className="space-y-1">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block rounded-md px-3 py-2 text-body-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
            <section>{children}</section>
          </div>
        </div>
      </main>
    </>
  );
}
