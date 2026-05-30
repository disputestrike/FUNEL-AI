"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

type NavGroup = {
  label: string;
  href?: string;
  items?: { label: string; href: string; description?: string }[];
};

const NAV: NavGroup[] = [
  {
    label: "Product",
    items: [
      { label: "Generate", href: "/#how-it-works", description: "Type a sentence, get a funnel." },
      { label: "Funnel Grader", href: "/grade", description: "Audit any funnel in 30 seconds." },
      { label: "Pricing", href: "/pricing", description: "Free until your first $1,000." },
      { label: "Industries", href: "/industries", description: "30 industries, one engine." },
      { label: "Integrations", href: "/integrations" },
      { label: "Roadmap", href: "/roadmap" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "GoFunnel Academy", href: "/academy" },
      { label: "Help Center", href: "/help" },
      { label: "Blog", href: "/blog" },
      { label: "Community", href: "/community" },
      { label: "GoFunnel Awards", href: "/awards" },
      { label: "GoFunnelCon", href: "/funnelcon" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

/**
 * The marketing nav (Product / Resources / Company megamenus + mobile drawer).
 * Kept as a client island so the parent <Header /> can stay server-rendered.
 */
export function HeaderNav() {
  const [open, setOpen] = React.useState(false);
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
        {NAV.map((group) => (
          <div
            key={group.label}
            className="relative"
            onMouseEnter={() => setActiveMenu(group.label)}
            onMouseLeave={() => setActiveMenu(null)}
          >
            <button
              className="inline-flex h-10 items-center rounded-md px-3 text-body-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              onClick={() =>
                setActiveMenu(activeMenu === group.label ? null : group.label)
              }
              aria-expanded={activeMenu === group.label}
              aria-haspopup="true"
            >
              {group.label}
            </button>
            {activeMenu === group.label && group.items && (
              <div
                className="absolute left-0 top-full pt-2"
                onMouseEnter={() => setActiveMenu(group.label)}
              >
                <div className="min-w-[260px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg animate-fade-up dark:border-slate-700 dark:bg-slate-800">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <div className="text-body-sm font-medium text-slate-900 dark:text-slate-50">
                        {item.label}
                      </div>
                      {item.description && (
                        <div className="text-caption text-slate-500">
                          {item.description}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>

      <button
        className="inline-flex size-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 lg:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <div
        className={cn(
          "absolute left-0 right-0 top-16 lg:hidden border-t border-slate-200 bg-slate-50 overflow-hidden z-30",
          open ? "max-h-[80vh]" : "max-h-0",
          "transition-all duration-medium ease-out-brand",
        )}
      >
        <div className="container py-4 space-y-6">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="text-caption font-semibold uppercase tracking-wider text-slate-500 mb-2">
                {group.label}
              </div>
              <div className="grid gap-1">
                {group.items?.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-2 py-2 text-body text-slate-900 hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
