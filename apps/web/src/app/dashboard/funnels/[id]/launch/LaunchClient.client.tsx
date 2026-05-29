"use client";

/**
 * Launch funnel — interactive client.
 *
 * Three sections:
 *   1. "Pick your URL" — slug input with real-time availability check.
 *   2. "Short link" — generated automatically on publish.
 *   3. "Custom domain" — input → DNS instructions → verification poll.
 *
 * Submitting the form calls POST /api/publish, which proxies to the api
 * server's publish.publishFunnel tRPC mutation.
 *
 * On success: confetti, then show 3 URLs (subdomain, short, custom) each
 * with a copy button + QR + share. Below that, the analytics teaser.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Globe, Link as LinkIcon, Loader2, Plus, QrCode, Sparkles } from "lucide-react";

interface ShortLink {
  code: string;
  url: string;
  vanity: boolean;
  clickCount: number;
}

interface PublishedSnapshot {
  slug: string;
  subdomainUrl: string;
  customUrl: string | null;
  version: number;
  status: string;
  shortLinks: ShortLink[];
  publishedAt: string;
}

interface CustomDomainRow {
  id: string;
  hostname: string;
  status: string;
  sslStatus: string;
  verificationToken: string;
}

export interface LaunchClientProps {
  funnelId: string;
  funnelName: string;
  vertical: string;
  workspaceSlug: string;
  workspacePlan: string;
  initialPublished: PublishedSnapshot | null;
  customDomains: CustomDomainRow[];
}

const APEX = "gofunnelai.com";
const SHORT_APEX = "gofnl.co";

const SLUG_RX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

function defaultSlugFor(vertical: string, funnelId: string): string {
  const base = vertical
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16) || "funnel";
  // 3 chars of funnel id to keep it stable on re-renders.
  const tail = funnelId.replace(/[^a-z0-9]/gi, "").slice(-3).toLowerCase();
  return `${base}-${tail || "x9k"}`;
}

export function LaunchClient(props: LaunchClientProps) {
  const [slug, setSlug] = useState(props.initialPublished?.slug ?? defaultSlugFor(props.vertical, props.funnelId));
  const [slugCheck, setSlugCheck] = useState<{ state: "idle" | "checking" | "ok" | "taken" | "invalid"; msg?: string }>(
    { state: "idle" }
  );
  const [showCustom, setShowCustom] = useState(props.customDomains.length > 0);
  const [chosenCustomId, setChosenCustomId] = useState<string | null>(
    props.customDomains.find((d) => d.status === "active" || d.status === "verified")?.id ?? null
  );
  const [newDomain, setNewDomain] = useState("");
  const [published, setPublished] = useState<PublishedSnapshot | null>(props.initialPublished);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);

  // Slug availability check — debounced.
  useEffect(() => {
    if (!slug) {
      setSlugCheck({ state: "idle" });
      return;
    }
    if (!SLUG_RX.test(slug)) {
      setSlugCheck({ state: "invalid", msg: "Use 3-32 lowercase letters, numbers, or dashes." });
      return;
    }
    setSlugCheck({ state: "checking" });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/publish/check-slug?slug=${encodeURIComponent(slug)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setSlugCheck({ state: "invalid", msg: "Could not check availability." });
          return;
        }
        const j = (await res.json()) as { available: boolean; owned_by_current_workspace: boolean };
        if (j.available || j.owned_by_current_workspace) {
          setSlugCheck({ state: "ok" });
        } else {
          setSlugCheck({ state: "taken", msg: "That URL is taken. Try another." });
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setSlugCheck({ state: "invalid", msg: "Network error." });
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [slug]);

  const canPublish = useMemo(
    () =>
      !!slug &&
      SLUG_RX.test(slug) &&
      slugCheck.state !== "checking" &&
      slugCheck.state !== "invalid" &&
      slugCheck.state !== "taken",
    [slug, slugCheck.state]
  );

  const customDomain = chosenCustomId ? props.customDomains.find((d) => d.id === chosenCustomId) : null;
  const customDomainReady =
    customDomain && (customDomain.status === "verified" || customDomain.status === "active");

  const publish = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          funnel_id: props.funnelId,
          slug,
          custom_domain: customDomainReady ? customDomain!.hostname : undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? "Publish failed");
        return;
      }
      const j = (await res.json()) as {
        slug: string;
        subdomain_url: string;
        short_url: string;
        short_code: string;
        custom_url: string | null;
        version: number;
        published_at: string;
      };
      setPublished({
        slug: j.slug,
        subdomainUrl: j.subdomain_url,
        customUrl: j.custom_url,
        version: j.version,
        status: "active",
        shortLinks: [{ code: j.short_code, url: j.short_url, vanity: false, clickCount: 0 }],
        publishedAt: j.published_at,
      });
      setConfetti(true);
      setTimeout(() => setConfetti(false), 4000);
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(false);
    }
  }, [props.funnelId, slug, customDomain, customDomainReady]);

  return (
    <div className="space-y-8">
      {confetti && <ConfettiOverlay />}

      {/* ---- Pick your URL ---------------------------------------------- */}
      <Card>
        <CardHeader
          icon={<Globe className="h-5 w-5 text-indigo-600" />}
          title="Pick your URL"
          subtitle={`Your funnel will be free, fast, and live at <slug>.${APEX}.`}
        />
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="slug-input">
            Choose your subdomain
          </label>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
            <input
              id="slug-input"
              type="text"
              className="flex-1 bg-white px-3 py-2 text-base outline-none"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="solar-x9k"
              spellCheck={false}
              autoComplete="off"
              maxLength={32}
            />
            <span className="flex items-center bg-slate-50 px-3 text-slate-500">.{APEX}</span>
          </div>
          <SlugStatus check={slugCheck} />
        </div>
      </Card>

      {/* ---- Short link (preview before publish) ----------------------- */}
      <Card>
        <CardHeader
          icon={<LinkIcon className="h-5 w-5 text-indigo-600" />}
          title="Short link"
          subtitle={`We'll generate a 6-character ${SHORT_APEX}/xxx link for SMS, QR codes, and business cards.`}
        />
        {published?.shortLinks?.length ? (
          <ShortLinkRow link={published.shortLinks[0]!} />
        ) : (
          <p className="text-sm text-slate-500">
            Your short link will appear here after you launch.
          </p>
        )}
      </Card>

      {/* ---- Custom domain ----------------------------------------------- */}
      <Card>
        <CardHeader
          icon={<Globe className="h-5 w-5 text-indigo-600" />}
          title="Custom domain (optional)"
          subtitle="Use your own domain like getfreequote.com. Requires Growth tier or above."
        />
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          onClick={() => setShowCustom((v) => !v)}
        >
          {showCustom ? "Hide" : "Connect a custom domain"}
        </button>

        {showCustom && (
          <div className="mt-4 space-y-3">
            {props.customDomains.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Choose a verified domain</label>
                {props.customDomains.map((d) => (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="custom-domain"
                        checked={chosenCustomId === d.id}
                        onChange={() => setChosenCustomId(d.id)}
                        disabled={d.status !== "verified" && d.status !== "active"}
                      />
                      <span className="font-mono text-sm">{d.hostname}</span>
                    </span>
                    <CustomDomainBadge status={d.status} ssl={d.sslStatus} />
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Add a new domain</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                  placeholder="getfreequote.com"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={!newDomain || pending}
                  onClick={async () => {
                    if (!newDomain) return;
                    setPending(true);
                    setError(null);
                    try {
                      const res = await fetch("/api/domains", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ domain: newDomain }),
                      });
                      if (!res.ok) {
                        const j = (await res.json().catch(() => null)) as { error?: string } | null;
                        setError(j?.error ?? "Could not add domain");
                      } else {
                        // Hard refresh to load the new row.
                        window.location.reload();
                      }
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
              <p className="text-xs text-slate-500">
                After adding, we'll show CNAME + TXT records for your DNS provider. Once verified
                (~5 min), it will appear in the list above.
              </p>
            </div>

            {customDomain && customDomain.status !== "active" && (
              <DnsInstructionsPanel domain={customDomain} />
            )}
          </div>
        )}
      </Card>

      {/* ---- Launch button --------------------------------------------- */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish || pending}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {published ? "Republish funnel" : "Launch funnel"}
        </button>
      </div>

      {/* ---- After-publish success view ------------------------------- */}
      {published && (
        <Card highlight>
          <CardHeader
            icon={<Check className="h-5 w-5 text-emerald-600" />}
            title="Your funnel is live"
            subtitle={`Version ${published.version} · published ${new Date(published.publishedAt).toLocaleString()}`}
          />
          <div className="space-y-4">
            <UrlRow label="Subdomain" url={published.subdomainUrl} />
            {published.shortLinks[0] && (
              <UrlRow label="Short link" url={published.shortLinks[0].url} qr={published.shortLinks[0].url} />
            )}
            {published.customUrl && <UrlRow label="Custom domain" url={published.customUrl} />}
            <div className="rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <strong>Visits will appear here in real time.</strong> Open the{" "}
              <a className="underline" href={`/dashboard/funnels/${props.funnelId}/analytics`}>
                analytics tab
              </a>{" "}
              to track conversions.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ----- Small components ----------------------------------------------------

function Card(props: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
        props.highlight ? "ring-2 ring-emerald-300" : ""
      }`}
    >
      {props.children}
    </section>
  );
}

function CardHeader(props: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-1">{props.icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{props.subtitle}</p>
      </div>
    </div>
  );
}

function SlugStatus(props: { check: { state: string; msg?: string } }) {
  const { state, msg } = props.check;
  if (state === "idle") return null;
  if (state === "checking")
    return (
      <p className="flex items-center gap-1 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
      </p>
    );
  if (state === "ok")
    return (
      <p className="flex items-center gap-1 text-xs text-emerald-600">
        <Check className="h-3 w-3" /> Available
      </p>
    );
  return <p className="text-xs text-red-600">{msg ?? "Unavailable"}</p>;
}

function UrlRow(props: { label: string; url: string; qr?: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{props.label}</p>
          <p className="truncate font-mono text-sm text-slate-900">{props.url}</p>
        </div>
        <div className="flex items-center gap-1">
          {props.qr && (
            <button
              type="button"
              className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-slate-900"
              onClick={() => setShowQr((v) => !v)}
              aria-label="Show QR code"
            >
              <QrCode className="h-4 w-4" />
            </button>
          )}
          <a
            href={props.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-slate-900"
            aria-label="Open"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-slate-900"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(props.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* noop */
              }
            }}
            aria-label="Copy URL"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {showQr && props.qr && (
        <div className="mt-3 flex justify-center">
          <img
            alt={`QR code for ${props.url}`}
            className="h-40 w-40 rounded-md bg-white"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(
              props.qr
            )}`}
          />
        </div>
      )}
    </div>
  );
}

function ShortLinkRow(props: { link: ShortLink }) {
  return <UrlRow label="Short link" url={props.link.url} qr={props.link.url} />;
}

function CustomDomainBadge(props: { status: string; ssl: string }) {
  let color = "bg-amber-100 text-amber-800";
  let label = props.status;
  if (props.status === "active" && props.ssl === "active") {
    color = "bg-emerald-100 text-emerald-800";
    label = "active";
  } else if (props.status === "verified") {
    color = "bg-blue-100 text-blue-800";
    label = `verified · ssl ${props.ssl}`;
  } else if (props.status === "failed") {
    color = "bg-red-100 text-red-800";
    label = "failed";
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

function DnsInstructionsPanel(props: { domain: CustomDomainRow }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-2 text-sm font-medium text-slate-700">Add these records to your DNS provider:</p>
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="w-16 py-1">Type</th>
            <th className="py-1">Name</th>
            <th className="py-1">Value</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          <tr>
            <td className="py-1">CNAME</td>
            <td className="py-1">{props.domain.hostname.split(".")[0]}</td>
            <td className="py-1">edge.gofunnelai.com</td>
          </tr>
          <tr>
            <td className="py-1">TXT</td>
            <td className="py-1 break-all">_funnel-verify.{props.domain.hostname}</td>
            <td className="py-1 break-all">{props.domain.verificationToken}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            setVerifying(true);
            setResult(null);
            try {
              const res = await fetch("/api/domains/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ domain: props.domain.hostname }),
              });
              const j = (await res.json()) as { ok: boolean; failure_reason?: string };
              setResult(
                j.ok
                  ? "Verified! SSL is provisioning — usually takes 1-5 minutes."
                  : j.failure_reason ?? "Still waiting on DNS propagation."
              );
            } catch (err) {
              setResult(String(err));
            } finally {
              setVerifying(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={verifying}
        >
          {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Verify DNS
        </button>
        {result && <span className="text-xs text-slate-600">{result}</span>}
      </div>
    </div>
  );
}

function ConfettiOverlay() {
  // Minimal CSS-only confetti — avoids pulling in a dep.
  const pieces = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style>{`
        @keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        .confetti-piece { position: absolute; width: 8px; height: 14px; border-radius: 2px; animation: confetti-fall 3.5s linear forwards; }
      `}</style>
      {pieces.map((_, i) => {
        const colors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9"];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}vw`,
              top: "-10vh",
              background: color,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
