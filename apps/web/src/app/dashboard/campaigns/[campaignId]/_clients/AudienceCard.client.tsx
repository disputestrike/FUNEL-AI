"use client";

/**
 * One audience card per AudienceProfile row.
 *
 * Renders the right set of targeting bullets for each platform:
 *
 *   Meta     → locations, age, interests, behaviors, lookalikes, exclusions
 *   Google   → keywords, negatives, ad groups, in-market segments
 *   LinkedIn → job titles, industries, seniority, company sizes
 *   TikTok   → interest clusters, behaviors, hashtags
 *   default  → JSON dump of targeting + reach
 */
import { useState } from "react";
import { Loader2, RefreshCcw, Users } from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface CardData {
  id: string;
  platform: string;
  platformLabel: string;
  targeting: Record<string, unknown>;
  exclusions: unknown[];
  lookalikeSource: string | null;
  estimatedReach: number | null;
}

export function AudienceCard({
  campaignId,
  card,
}: {
  campaignId: string;
  card: CardData;
}) {
  const { run, pending } = useLaunchMutation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/audiences/${card.id}/regenerate`, {
        reason: reason.trim() || null,
      });
      setOpen(false);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't regenerate the audience");
    }
  }

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{card.platformLabel}</h3>
          {card.estimatedReach !== null ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-600">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Est. reach {card.estimatedReach.toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCcw className="h-3 w-3" />
          Regenerate
        </button>
      </header>

      <div className="mt-4 space-y-3">
        <TargetingBody platform={card.platform} targeting={card.targeting} />
        {card.lookalikeSource ? (
          <Row label="Lookalike source" value={card.lookalikeSource} />
        ) : null}
        {card.exclusions.length > 0 ? (
          <Row
            label="Exclusions"
            value={card.exclusions
              .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
              .join(", ")}
          />
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 rounded-lg bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-200">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Why regenerate? (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="Drop the lookalike — broaden the interests instead."
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
            />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
              Run again
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TargetingBody({
  platform,
  targeting,
}: {
  platform: string;
  targeting: Record<string, unknown>;
}) {
  switch (platform) {
    case "meta":
      return (
        <>
          <Row label="Locations" value={joinList(targeting.locations)} />
          <Row label="Age" value={joinAge(targeting.ageMin, targeting.ageMax)} />
          <Row label="Interests" value={joinList(targeting.interests)} />
          <Row label="Behaviors" value={joinList(targeting.behaviors)} />
          <Row label="Lookalikes" value={joinList(targeting.lookalikes)} />
        </>
      );
    case "google":
      return (
        <>
          <Row label="Keywords" value={joinList(targeting.keywords)} />
          <Row label="Negative keywords" value={joinList(targeting.negativeKeywords)} />
          <Row label="Ad groups" value={joinList(targeting.adGroups)} />
          <Row label="In-market segments" value={joinList(targeting.inMarket)} />
        </>
      );
    case "linkedin":
      return (
        <>
          <Row label="Job titles" value={joinList(targeting.jobTitles)} />
          <Row label="Industries" value={joinList(targeting.industries)} />
          <Row label="Seniority" value={joinList(targeting.seniority)} />
          <Row label="Company size" value={joinList(targeting.companySize)} />
        </>
      );
    case "tiktok":
      return (
        <>
          <Row label="Interest clusters" value={joinList(targeting.interestClusters ?? targeting.interests)} />
          <Row label="Behaviors" value={joinList(targeting.behaviors)} />
          <Row label="Hashtags" value={joinList(targeting.hashtags)} />
        </>
      );
    default: {
      const entries = Object.entries(targeting);
      if (entries.length === 0) {
        return <p className="text-xs italic text-slate-400">No targeting parameters yet.</p>;
      }
      return (
        <>
          {entries.map(([k, v]) => (
            <Row key={k} label={titleize(k)} value={joinList(v)} />
          ))}
        </>
      );
    }
  }
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-xs">
      <span className="font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-slate-800">
        {value && value.length > 0 ? value : <span className="italic text-slate-400">—</span>}
      </span>
    </div>
  );
}

function joinList(v: unknown): string | null {
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
  }
  if (typeof v === "string") return v;
  if (v == null) return null;
  return JSON.stringify(v);
}

function joinAge(min: unknown, max: unknown): string | null {
  const mn = typeof min === "number" ? min : null;
  const mx = typeof max === "number" ? max : null;
  if (mn === null && mx === null) return null;
  return `${mn ?? "18"} – ${mx ?? "65+"}`;
}

function titleize(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
