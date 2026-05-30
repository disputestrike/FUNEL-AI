"use client";

/**
 * Domains settings — interactive client.
 *
 * Features:
 *   - Add a custom domain (POST /api/domains)
 *   - List domains with live status badges
 *   - For each: CNAME + TXT instructions with copy buttons
 *   - "Verify now" button + automatic polling while ssl_status is provisioning
 *   - "Remove" button (DELETE /api/domains/[id])
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const APEX = "gofunnelai.com";
const EDGE = `edge.${APEX}`;

export interface DomainRow {
  id: string;
  hostname: string;
  status: string;
  ssl_status: string;
  verification_token: string;
  verified_at: string | null;
  activated_at: string | null;
  failure_reason: string | null;
}

export interface DomainsClientProps {
  plan: string;
  initialDomains: DomainRow[];
}

export function DomainsClient({ plan, initialDomains }: DomainsClientProps) {
  const [domains, setDomains] = useState<DomainRow[]>(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gated = !["growth", "scale", "enterprise"].includes(plan);

  const refreshOne = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/domains/${id}`);
      if (!res.ok) return;
      const j = (await res.json()) as DomainRow;
      setDomains((cur) => cur.map((d) => (d.id === id ? { ...d, ...j } : d)));
    } catch {
      /* noop */
    }
  }, []);

  // Auto-poll any domain that's mid-provisioning.
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  useEffect(() => {
    const toPoll = domains.filter(
      (d) =>
        d.status !== "active" ||
        (d.ssl_status !== "active" && d.ssl_status !== "failed")
    );
    for (const d of toPoll) {
      if (pollRefs.current.has(d.id)) continue;
      const interval = setInterval(() => {
        refreshOne(d.id);
      }, 20_000);
      pollRefs.current.set(d.id, interval);
    }
    // Clean up timers for rows that are now done or removed.
    for (const [id, timer] of pollRefs.current.entries()) {
      const row = domains.find((d) => d.id === id);
      if (!row || (row.status === "active" && row.ssl_status === "active")) {
        clearInterval(timer);
        pollRefs.current.delete(id);
      }
    }
    return () => {
      /* keep intervals alive across re-renders; cleanup happens above */
    };
  }, [domains, refreshOne]);

  useEffect(() => {
    return () => {
      for (const t of pollRefs.current.values()) clearInterval(t);
      pollRefs.current.clear();
    };
  }, []);

  const addDomain = useCallback(async () => {
    if (!newDomain) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: newDomain.toLowerCase().trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(prettyError(j?.error) ?? "Could not add domain");
        return;
      }
      const j = (await res.json()) as DomainRow & { instructions: unknown };
      setDomains((cur) => [
        {
          id: j.id,
          hostname: j.hostname,
          status: j.status,
          ssl_status: j.ssl_status,
          verification_token: j.verification_token,
          verified_at: j.verified_at,
          activated_at: j.activated_at,
          failure_reason: null,
        },
        ...cur,
      ]);
      setNewDomain("");
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
    }
  }, [newDomain]);

  const verifyDomain = useCallback(async (id: string) => {
    setDomains((cur) =>
      cur.map((d) => (d.id === id ? { ...d, status: "verifying", failure_reason: null } : d))
    );
    try {
      const res = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
      const j = (await res.json()) as Partial<DomainRow> & {
        ok: boolean;
        failure_reason?: string;
        ssl_status?: string;
        status?: string;
      };
      setDomains((cur) =>
        cur.map((d) =>
          d.id === id
            ? {
                ...d,
                status: j.status ?? d.status,
                ssl_status: j.ssl_status ?? d.ssl_status,
                failure_reason: j.failure_reason ?? null,
              }
            : d
        )
      );
    } catch (err) {
      setDomains((cur) =>
        cur.map((d) =>
          d.id === id ? { ...d, failure_reason: String(err), status: "verifying" } : d
        )
      );
    }
  }, []);

  const removeDomain = useCallback(async (id: string) => {
    if (!confirm("Remove this custom domain? Funnels using it will fall back to the GoFunnelAI subdomain.")) {
      return;
    }
    try {
      const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove domain.");
        return;
      }
      setDomains((cur) => cur.filter((d) => d.id !== id));
    } catch (err) {
      setError(String(err));
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* ---- Add new domain --------------------------------------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-start gap-3">
          <div className="mt-1">
            <Plus className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add a custom domain</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {gated
                ? "Custom domains require the Growth plan. Upgrade to unlock."
                : "Enter the domain you'd like to use, then add the DNS records we show you."}
            </p>
          </div>
        </header>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value.toLowerCase().trim())}
            placeholder="getfreequote.com"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            disabled={gated || adding}
            spellCheck={false}
          />
          <button
            type="button"
            onClick={addDomain}
            disabled={gated || adding || !newDomain}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add domain
          </button>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}
      </section>

      {/* ---- Existing domains ------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Connected domains
        </h2>
        {domains.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No custom domains yet. Add one above to get started.
          </div>
        ) : (
          domains.map((d) => (
            <DomainCard
              key={d.id}
              domain={d}
              onVerify={() => verifyDomain(d.id)}
              onRemove={() => removeDomain(d.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function DomainCard({
  domain,
  onVerify,
  onRemove,
}: {
  domain: DomainRow;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const isApex = domain.hostname.split(".").length === 2;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-slate-600" />
          <div>
            <h3 className="font-mono text-base font-semibold text-slate-900">{domain.hostname}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {domain.activated_at
                ? `Activated ${new Date(domain.activated_at).toLocaleString()}`
                : domain.verified_at
                  ? `Verified ${new Date(domain.verified_at).toLocaleString()}`
                  : "Awaiting verification"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={domain.status} ssl={domain.ssl_status} />
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove domain"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {domain.status !== "active" && (
        <div className="space-y-3">
          <DnsTable hostname={domain.hostname} token={domain.verification_token} isApex={isApex} />

          <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-600">
              After saving the DNS records, click verify. SSL provisions in 1-5 minutes once verified.
            </span>
            <button
              type="button"
              onClick={async () => {
                setVerifying(true);
                try {
                  await Promise.resolve(onVerify());
                } finally {
                  setVerifying(false);
                }
              }}
              disabled={verifying}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Verify now
            </button>
          </div>
        </div>
      )}

      {domain.failure_reason && (
        <p className="mt-3 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" /> {domain.failure_reason}
        </p>
      )}
    </article>
  );
}

function StatusBadge({ status, ssl }: { status: string; ssl: string }) {
  if (status === "active" && ssl === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <ShieldCheck className="h-3 w-3" /> active · SSL
      </span>
    );
  }
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
        <Shield className="h-3 w-3" /> verified · SSL {ssl}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        <AlertTriangle className="h-3 w-3" /> failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      <Loader2 className="h-3 w-3 animate-spin" /> {status}
    </span>
  );
}

function DnsTable({ hostname, token, isApex }: { hostname: string; token: string; isApex: boolean }) {
  const cnameName = isApex ? "@" : hostname.split(".")[0];
  const cnameTypeLabel = isApex ? "ANAME / ALIAS" : "CNAME";

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full table-fixed text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="text-left">
            <th className="w-24 px-3 py-2">Type</th>
            <th className="w-1/3 px-3 py-2">Name</th>
            <th className="px-3 py-2">Value</th>
            <th className="w-12 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="font-mono">
          <tr className="border-t border-slate-100">
            <td className="px-3 py-2">{cnameTypeLabel}</td>
            <td className="break-all px-3 py-2">{cnameName}</td>
            <td className="break-all px-3 py-2">{EDGE}</td>
            <td className="px-3 py-2">
              <CopyButton text={EDGE} />
            </td>
          </tr>
          <tr className="border-t border-slate-100">
            <td className="px-3 py-2">TXT</td>
            <td className="break-all px-3 py-2">_funnel-verify.{hostname}</td>
            <td className="break-all px-3 py-2">{token}</td>
            <td className="px-3 py-2">
              <CopyButton text={token} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* noop */
        }
      }}
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function prettyError(code?: string): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "invalid_body":
      return "That doesn't look like a valid domain.";
    case "domain_in_use_elsewhere":
      return "That domain is already connected to another workspace.";
    case "unauthorized":
      return "You need to sign in.";
    default:
      return undefined;
  }
}
