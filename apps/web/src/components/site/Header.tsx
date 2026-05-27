"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Lockup } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
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

export function Header() {
  const [open, setOpen] = React.useState(false);
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/80">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center" aria-label="GoFunnelAI home">
          <Lockup height={30} />
        </Link>

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
                onClick={() => setActiveMenu(activeMenu === group.label ? null : group.label)}
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
                          <div className="text-caption text-slate-500">{item.description}</div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/grade"
            className="mr-1 inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-body-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Grade your funnel
          </Link>
          <Button variant="tertiary" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link href="/signup">Get started - free</Link>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md px-1.5 text-body-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-md bg-[linear-gradient(135deg,#6817d2_0%,#d91a8f_48%,#ff7a00_100%)] px-2 text-body-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            Sign up
          </Link>
          <button
            className="inline-flex size-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "lg:hidden border-t border-slate-200 bg-slate-50 overflow-hidden",
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
          <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
            <Link
              href="/grade"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-body-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
            >
              Grade your funnel
            </Link>
            <Button variant="secondary" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="primary" asChild>
              <Link href="/signup">Get started - free</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
