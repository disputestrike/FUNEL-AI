/**
 * Shared display primitives for the Launch Center cockpit.
 *
 * Loading / empty / error states matching the GoFunnelAI design system —
 * each tab page composes these instead of rolling its own.
 */
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function EmptyCard({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-signal-50 text-signal-600">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
        <div>
          <h3 className="text-sm font-semibold text-rose-900">We hit a snag</h3>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function LoadingPill({ label = "Loading…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  reddit: "Reddit",
};
