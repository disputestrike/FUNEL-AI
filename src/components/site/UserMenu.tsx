"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { LayoutDashboard, LogOut, Settings } from "lucide-react";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  /** Mobile-style trigger (avatar-only, no name label). */
  compact?: boolean;
};

/**
 * Avatar + dropdown for signed-in users. Pulls the avatar straight from
 * the Google profile (`session.user.image`) and exposes Dashboard /
 * Settings / Sign out.
 */
export function UserMenu({ user, compact = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initials =
    (user.name ?? user.email ?? "U")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-0.5 pr-2 text-body-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Account"}
            width={32}
            height={32}
            className="size-8 rounded-full"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-signal-100 text-caption font-semibold text-signal-700">
            {initials}
          </span>
        )}
        {!compact && (
          <span className="hidden max-w-[120px] truncate sm:inline">
            {user.name ?? user.email}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="truncate text-body-sm font-medium text-slate-900">
              {user.name ?? "Signed in"}
            </div>
            {user.email && (
              <div className="truncate text-caption text-slate-500">
                {user.email}
              </div>
            )}
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-body-sm text-slate-700 hover:bg-slate-50"
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-body-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-body-sm text-slate-700 hover:bg-slate-50"
            role="menuitem"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
