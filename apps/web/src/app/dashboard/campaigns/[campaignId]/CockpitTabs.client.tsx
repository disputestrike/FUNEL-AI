"use client";

/**
 * Horizontal 11-tab nav for the Launch Center cockpit.
 *
 * Active state is derived from `usePathname()` against the per-tab href.
 * Mobile: the tabs scroll horizontally with snap.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  MailCheck,
  MessageSquare,
  Package,
  ShieldCheck,
  Target,
  Users,
  Video,
} from "lucide-react";

interface Props {
  campaignId: string;
}

export function CockpitTabs({ campaignId }: Props) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/campaigns/${campaignId}`;

  const tabs = [
    { href: base, label: "Campaign Plan", Icon: Target, match: (p: string) => p === base },
    { href: `${base}/platforms`, label: "Platforms", Icon: Layers },
    { href: `${base}/audiences`, label: "Audiences", Icon: Users },
    { href: `${base}/copy`, label: "Copy", Icon: MessageSquare },
    { href: `${base}/images`, label: "Images", Icon: ImageIcon },
    { href: `${base}/videos`, label: "Videos", Icon: Video },
    { href: `${base}/links`, label: "Links", Icon: LinkIcon },
    { href: `${base}/follow-up`, label: "Follow-Up", Icon: MailCheck },
    { href: `${base}/tracking`, label: "Tracking", Icon: BarChart3 },
    { href: `${base}/compliance`, label: "Compliance", Icon: ShieldCheck },
    { href: `${base}/export`, label: "Export", Icon: Package },
  ];

  return (
    <nav
      aria-label="Campaign sections"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      {tabs.map(({ href, label, Icon, match }) => {
        const active = match ? match(pathname) : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group inline-flex shrink-0 snap-start items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-signal-50 text-signal-700 ring-1 ring-inset ring-signal-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
