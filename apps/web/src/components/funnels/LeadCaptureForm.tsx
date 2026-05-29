"use client";

import * as React from "react";
import type { AutomatedFunnel, FunnelFormField } from "@funnel/orchestrator";

type LeadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "sent"; leadId: string; nextPath: string; routing: Record<string, boolean> }
  | { status: "error"; message: string };

export function LeadCaptureForm({
  funnel,
  fields,
  cta,
}: {
  funnel: AutomatedFunnel;
  fields: FunnelFormField[];
  cta: string;
}) {
  const [state, setState] = React.useState<LeadState>({ status: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fieldsPayload = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    );

    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/funnels/${funnel.slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: fieldsPayload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Lead capture failed");
      setState({
        status: "sent",
        leadId: data.lead_id,
        nextPath: data.next_path,
        routing: data.routing,
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Lead capture failed",
      });
    }
  }

  if (state.status === "sent") {
    const activeRoutes = Object.entries(state.routing)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
    return (
      <div className="rounded-lg border border-white/30 bg-white/95 p-6 text-slate-950 shadow-2xl">
        <p className="text-xs font-semibold uppercase text-emerald-600">
          Lead captured
        </p>
        <h3 className="mt-2 text-2xl font-black">Your free asset is on the way.</h3>
        <p className="mt-2 text-sm text-slate-600">
          Ticket {state.leadId} is saved. {activeRoutes.length > 0
            ? `Automation routes now active: ${activeRoutes.join(", ")}.`
            : "Provider keys are not connected yet, so this local lead is saved without outbound follow-up."}
        </p>
        <a
          href={state.nextPath}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold text-white"
          style={{ background: funnel.styleGuide.button.gradient }}
        >
          Continue to the next step
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-white/30 bg-white/95 p-5 text-slate-950 shadow-2xl">
      <div className="grid gap-3">
        {fields.map((field) => (
          <label key={field.id} className="grid gap-1.5 text-sm font-semibold">
            {field.label}
            {field.type === "select" ? (
              <select
                name={field.id}
                required={field.required}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-950"
              >
                <option value="">Select one</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.id}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-950"
              />
            )}
          </label>
        ))}
      </div>
      {state.status === "error" ? (
        <p className="mt-3 text-sm font-medium text-red-600">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={state.status === "loading"}
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        style={{ background: funnel.styleGuide.button.gradient }}
      >
        {state.status === "loading" ? "Capturing..." : cta}
      </button>
    </form>
  );
}
