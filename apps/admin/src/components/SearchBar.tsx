"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Top-level admin search.
 *
 * Routes the query based on shape:
 *  - email pattern  → /customers?q=
 *  - ws_*          → /customers/{id}
 *  - in_*, pi_*    → /billing-reconciliation?q=
 *  - http(s)://    → /funnels?q=
 *  - everything else → /customers?q=
 */
export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (v.startsWith("ws_")) {
      router.push(`/customers/${encodeURIComponent(v)}`);
      return;
    }
    if (v.startsWith("in_") || v.startsWith("pi_") || v.startsWith("ch_")) {
      router.push(`/billing-reconciliation?q=${encodeURIComponent(v)}`);
      return;
    }
    if (v.startsWith("http")) {
      router.push(`/funnels?q=${encodeURIComponent(v)}`);
      return;
    }
    router.push(`/customers?q=${encodeURIComponent(v)}`);
  }

  return (
    <form
      onSubmit={submit}
      className="relative flex w-full max-w-xl items-center"
    >
      <Search className="absolute left-2 h-4 w-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="text"
        placeholder="Search email, workspace id, payment id, funnel URL..."
        className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-body-sm shadow-sm focus:border-signal-500 focus:outline-none"
      />
    </form>
  );
}
