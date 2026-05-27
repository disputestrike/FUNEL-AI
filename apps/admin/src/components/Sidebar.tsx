"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  ClipboardList,
  Database,
  FileText,
  Flag,
  Gauge,
  Layers,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  Workflow,
} from "lucide-react";
import type { AdminRole } from "@funnel/auth";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Roles that may see this nav item. Omitted = visible to all admins. */
  roles?: AdminRole[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/funnels", label: "Funnels", icon: Layers },
  { href: "/leads", label: "Leads", icon: Search },
  { href: "/queues", label: "Queues", icon: Workflow },
  { href: "/sentry", label: "Errors", icon: Bug },
  { href: "/integrations-health", label: "Integrations", icon: Gauge },
  { href: "/billing-reconciliation", label: "Billing recon", icon: Database },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/human-review-queue", label: "T&S queue", icon: ShieldCheck },
  { href: "/audit-log", label: "Audit log", icon: ScrollText },
  { href: "/data-requests", label: "GDPR queue", icon: ClipboardList },
  { href: "/runbooks", label: "Runbooks", icon: BookOpen },
  {
    href: "/feature-flags",
    label: "Feature flags",
    icon: Flag,
    roles: ["super_admin"],
  },
  {
    href: "/permissions",
    label: "Permissions",
    icon: ListChecks,
    roles: ["super_admin"],
  },
];

export function Sidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const visible = NAV.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
      <nav className="flex flex-col gap-0.5 p-3">
        {visible.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1.5 text-body-sm transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mt-2 rounded-md border border-error-200 bg-error-50 p-2 text-caption text-error-700">
        <Wrench className="mb-1 h-3.5 w-3.5" />
        <p className="font-medium">Every action you take is audited.</p>
        <p className="mt-0.5 text-error-600">
          Use reason fields. Don&apos;t paste customer PII.
        </p>
      </div>

      <div className="mx-3 mb-3 mt-2">
        <Link
          href="/runbooks/incident-response"
          className="flex items-center gap-1.5 text-caption text-slate-500 hover:text-slate-900"
        >
          <FileText className="h-3 w-3" />
          Incident response runbook
        </Link>
      </div>
    </aside>
  );
}
