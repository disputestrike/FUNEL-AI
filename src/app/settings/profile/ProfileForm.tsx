"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Editable preferences (timezone + locale). Defaults are pulled from
 * `Intl.DateTimeFormat().resolvedOptions()` on mount so the user sees
 * something sensible before they hit save.
 */
export function ProfileForm() {
  const [timezone, setTimezone] = React.useState("UTC");
  const [locale, setLocale] = React.useState("en-US");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    setTimezone(opts.timeZone || "UTC");
    setLocale(opts.locale || "en-US");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone, locale }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Preferences saved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-h4 font-semibold text-slate-900">Preferences</h2>
      <p className="mt-1 text-body-sm text-slate-500">
        Used for scheduled emails and dashboard timestamps.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-body-sm font-medium text-slate-700">
            Time zone
          </span>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-body-sm"
            placeholder="America/Los_Angeles"
          />
        </label>
        <label className="block">
          <span className="text-body-sm font-medium text-slate-700">
            Locale
          </span>
          <input
            type="text"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-body-sm"
            placeholder="en-US"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-6 inline-flex items-center rounded-md bg-signal-600 px-4 py-2 text-body-sm font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
