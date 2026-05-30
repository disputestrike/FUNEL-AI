"use client";

/**
 * Two-column follow-up editor.
 *
 * Email column on the left, SMS on the right. Each step is a card with
 * timing + subject (email only) + body + lightweight markdown preview.
 *
 * The "Approve all" footer transitions both sequences in one server call,
 * which the orchestrator gates on a successful policy review (handled
 * server-side in /api/launch/campaigns/:id/followup/approve).
 */
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCcw,
} from "lucide-react";

import { useLaunchMutation } from "../_shared/actions.client";

interface Step {
  timing: string;
  timingLabel: string;
  subject: string | null;
  body: string;
}

interface SequenceData {
  id: string | null;
  status: string;
  steps: Step[];
}

const TIMING_OPTIONS = [
  { value: "immediate", label: "Immediately" },
  { value: "day1", label: "Day 1" },
  { value: "day3", label: "Day 3" },
  { value: "day7", label: "Day 7" },
  { value: "no_show", label: "No-show" },
  { value: "reactivation", label: "Reactivation" },
];

export function FollowupEditor({
  campaignId,
  email,
  sms,
}: {
  campaignId: string;
  email: SequenceData;
  sms: SequenceData;
}) {
  const { run, pending } = useLaunchMutation();
  const [emailSteps, setEmailSteps] = useState(email.steps);
  const [smsSteps, setSmsSteps] = useState(sms.steps);
  const [error, setError] = useState<string | null>(null);

  function move(channel: "email" | "sms", index: number, dir: -1 | 1) {
    const setSteps = channel === "email" ? setEmailSteps : setSmsSteps;
    setSteps((prev) => {
      const next = [...prev];
      const swap = index + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }

  function addStep(channel: "email" | "sms") {
    const setSteps = channel === "email" ? setEmailSteps : setSmsSteps;
    setSteps((prev) => [
      ...prev,
      {
        timing: "day1",
        timingLabel: "Day 1",
        subject: channel === "email" ? "" : null,
        body: "",
      },
    ]);
  }

  function updateStep(channel: "email" | "sms", index: number, patch: Partial<Step>) {
    const setSteps = channel === "email" ? setEmailSteps : setSmsSteps;
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch, timingLabel: patch.timing ? labelOf(patch.timing) : s.timingLabel } : s)),
    );
  }

  async function regenerate(channel: "email" | "sms") {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/followup/${channel}/regenerate`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't regenerate the sequence");
    }
  }

  async function approveAll() {
    setError(null);
    try {
      await run(`/campaigns/${campaignId}/followup/approve`, {
        email: { steps: emailSteps },
        sms: { steps: smsSteps },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't approve the sequences");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-2">
        <Column
          title="Email"
          icon={Mail}
          steps={emailSteps}
          onMove={(i, dir) => move("email", i, dir)}
          onAdd={() => addStep("email")}
          onUpdate={(i, p) => updateStep("email", i, p)}
          onRegenerate={() => regenerate("email")}
          showSubject
          pending={pending}
          status={email.status}
        />
        <Column
          title="SMS"
          icon={MessageSquare}
          steps={smsSteps}
          onMove={(i, dir) => move("sms", i, dir)}
          onAdd={() => addStep("sms")}
          onUpdate={(i, p) => updateStep("sms", i, p)}
          onRegenerate={() => regenerate("sms")}
          showSubject={false}
          pending={pending}
          status={sms.status}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">
          Approving sends the sequence through compliance and saves it for the next launch.
        </p>
        <button
          type="button"
          onClick={approveAll}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve all
        </button>
      </div>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

function Column({
  title,
  icon: Icon,
  steps,
  onMove,
  onAdd,
  onUpdate,
  onRegenerate,
  showSubject,
  pending,
  status,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: Step[];
  onMove: (index: number, dir: -1 | 1) => void;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<Step>) => void;
  onRegenerate: () => void;
  showSubject: boolean;
  pending: boolean;
  status: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Icon className="h-4 w-4 text-signal-600" />
          {title}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {status}
          </span>
        </h3>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCcw className="h-3 w-3" />
          Regenerate
        </button>
      </header>

      <ul className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <select
                value={s.timing}
                onChange={(e) => onUpdate(i, { timing: e.target.value })}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                {TIMING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, 1)}
                  disabled={i === steps.length - 1}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {showSubject ? (
              <input
                type="text"
                value={s.subject ?? ""}
                onChange={(e) => onUpdate(i, { subject: e.target.value })}
                placeholder="Subject line"
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            ) : null}

            <textarea
              value={s.body}
              onChange={(e) => onUpdate(i, { body: e.target.value })}
              rows={4}
              placeholder={showSubject ? "Markdown body" : "Plain text (160 chars max)"}
              maxLength={showSubject ? 4000 : 320}
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
            />

            {s.body ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Preview
                </summary>
                <div className="mt-1 rounded-md bg-white p-2 text-xs leading-relaxed text-slate-800 ring-1 ring-slate-200">
                  {renderMarkdown(s.body)}
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add step
      </button>
    </section>
  );
}

function labelOf(v: string): string {
  return TIMING_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

/**
 * Bare-bones markdown renderer — bold, italic, line breaks, links.
 * Avoids pulling in a full md parser for a preview pane.
 */
function renderMarkdown(src: string): React.ReactNode {
  const escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-signal-700 underline">$1</a>')
    .replace(/\n/g, "<br />");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
