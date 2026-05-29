# Cloudflare DNS + custom-hostname setup — gofunnelai.com / gofnl.co

This is the canonical "how the edge is wired" doc for GoFunnelAI. Anything
that isn't here is either ad-hoc or in the wrong place — fix it.

There are two zones we manage:

| Zone               | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `gofunnelai.com`   | App, marketing, renderer apex, workspace subdomains, custom-hostname "edge" CNAME target. |
| `gofnl.co`         | Short links (6-char codes), redirects to subdomain or custom domain. |

Both zones live in the same Cloudflare account. Hyperdrive, Workers, and
Pages all sit in that account.

---

## 1. `gofunnelai.com` zone

### 1.1 Root + standard subdomains

| Record                | Type   | Value                       | Proxied | Notes |
| --------------------- | ------ | --------------------------- | ------- | ----- |
| `gofunnelai.com`      | A      | (Vercel/Cloudflare Pages IP for marketing) | Yes | Marketing landing. Set with the deploy target's recommended IP. |
| `www.gofunnelai.com`  | CNAME  | `cname.vercel-dns.com` (or Pages) | Yes | 301 → apex. |
| `app.gofunnelai.com`  | CNAME  | `funnel-web.up.railway.app` | Yes | The dashboard Next.js app. |
| `admin.gofunnelai.com` | CNAME | `funnel-admin.up.railway.app` | Yes | Internal admin. |
| `api.gofunnelai.com`  | CNAME  | `funnel-api.up.railway.app` | Yes | tRPC + REST API. |
| `assets.gofunnelai.com` | CNAME | `pub-<hash>.r2.dev`        | Yes | R2 public bucket (signed URLs preferred). |

### 1.2 Renderer routes — workspace subdomains + edge fallback

The renderer Worker (`funnel-renderer`) takes traffic for:

- `*.gofunnelai.com` (wildcard) — every workspace's `<slug>.gofunnelai.com`.
- `gofunnelai.com` — apex fallback (marketing redirect only if traffic
  somehow reaches the worker; the marketing site normally serves the apex).
- `edge.gofunnelai.com` — the **fallback origin** used by Cloudflare for
  SaaS for every CNAMEd customer hostname.

```toml
# apps/renderer/wrangler.toml — already configured.
[env.production]
routes = [
  { pattern = "*.gofunnelai.com/*", zone_name = "gofunnelai.com" },
  { pattern = "gofunnelai.com/*", zone_name = "gofunnelai.com" },
  { pattern = "edge.gofunnelai.com/*", zone_name = "gofunnelai.com" },
]
```

Required DNS to make the wildcard resolvable:

| Record                  | Type   | Value           | Proxied |
| ----------------------- | ------ | --------------- | ------- |
| `*.gofunnelai.com`      | CNAME  | `funnel-renderer.workers.dev` | Yes |
| `edge.gofunnelai.com`   | CNAME  | `funnel-renderer.workers.dev` | Yes |

Cloudflare's Workers routing only fires on **proxied** records, so the
"Proxied" toggle MUST be on. The wildcard CNAME target can be anything
"valid" — Workers routes match on hostname, not on the CNAME target.

### 1.3 Cloudflare for SaaS — custom hostnames

Customers add their own domain (e.g. `getfreequote.com`) and CNAME a label
on it to `edge.gofunnelai.com`. We onboard their hostname through the
[Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-saas/start/getting-started/)
API; Cloudflare provisions the cert; the renderer Worker serves the
funnel.

**Settings to apply once per account**:

- Cloudflare for SaaS → Custom hostnames → enabled.
- Fallback origin: `edge.gofunnelai.com` (record above).
- Method: HTTP for DV (faster issuance).
- Certificate authority: Let's Encrypt + Google Trust Services (round-robin).
- Validation: TXT preferred (HTTP works too but breaks if upstream returns
  a redirect during validation).

**API surface used by `apps/api`**:

```
POST   /zones/:zone_id/custom_hostnames
GET    /zones/:zone_id/custom_hostnames/:id
DELETE /zones/:zone_id/custom_hostnames/:id
```

`apps/web` proxies into `apps/api` via the internal
`/internal/custom-domains/*` bridge (see
`apps/web/src/app/api/domains/[id]/verify/route.ts`). The API token is
stored as the `CLOUDFLARE_API_TOKEN` secret in `apps/api`.

**Customer DNS records we tell them to add** (also rendered in the UI):

| Their DNS                       | Type   | Value                            |
| ------------------------------- | ------ | -------------------------------- |
| `<sub>.<their-domain>`          | CNAME  | `edge.gofunnelai.com`            |
| `@` for apex                    | ANAME / ALIAS / CNAME-flattening | `edge.gofunnelai.com` |
| `_funnel-verify.<their-domain>` | TXT    | (the row's `verification_token`) |

The TXT record is our ownership-proof. We check it from
`apps/web/src/app/api/domains/[id]/verify/route.ts` before kicking off the
Cloudflare API call.

### 1.4 Email / DMARC

| Record               | Type | Value |
| -------------------- | ---- | ----- |
| `gofunnelai.com`     | MX   | (Postmark / Resend MX) |
| `_dmarc`             | TXT  | `v=DMARC1; p=quarantine; rua=mailto:dmarc@gofunnelai.com; pct=100;` |
| `<selector>._domainkey` | TXT | (DKIM from the email provider) |
| `gofunnelai.com`     | TXT  | `v=spf1 include:resend.com include:postmarkapp.com ~all` |

---

## 2. `gofnl.co` zone (short links)

`gofnl.co/<6chars>` 302-redirects to the long subdomain or custom domain
URL. Owned by the `short-links` Worker.

| Record           | Type   | Value                          | Proxied |
| ---------------- | ------ | ------------------------------ | ------- |
| `gofnl.co`       | A      | (Cloudflare proxy IP)          | Yes |
| `www.gofnl.co`   | CNAME  | `gofnl.co`                     | Yes |

Worker route:

```toml
# apps/short-links/wrangler.toml
[env.production]
routes = [
  { pattern = "gofnl.co/*", zone_name = "gofnl.co" },
]
```

DNS for the Workers route: same trick — a proxied CNAME from `gofnl.co` to
`funnel-short-links.workers.dev`. The Worker route matches on hostname.

---

## 3. Required env vars (production)

```bash
# apps/web (Next.js — Railway)
DATABASE_URL=postgres://...                   # Hyperdrive-bridged
INTERNAL_INGEST_SECRET=...                    # shared with apps/api
API_BASE_URL=https://api.gofunnelai.com
NEXT_PUBLIC_API_BASE_URL=https://api.gofunnelai.com

# apps/api (tRPC server — Railway)
DATABASE_URL=postgres://...
CLOUDFLARE_API_TOKEN=...                      # zones-edit + custom-hostnames
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ZONE_ID_GOFUNNELAI=...
INTERNAL_INGEST_SECRET=...

# apps/renderer (Worker)
FORM_HMAC_SECRET=...
TURNSTILE_SECRET_KEY=...
INTERNAL_INGEST_SECRET=...
```

---

## 4. Verification checklist (run before flipping DNS on production)

- [ ] `dig +short edge.gofunnelai.com` returns a Cloudflare proxy IP.
- [ ] `dig +short '*.gofunnelai.com'` returns the same range.
- [ ] `curl -I https://test-slug.gofunnelai.com` returns the renderer
      Worker's `x-funnel-renderer: 1` header (404 page for unknown slugs is
      fine — the point is the Worker is in the path).
- [ ] Cloudflare for SaaS → Custom hostnames table shows
      `edge.gofunnelai.com` as the fallback origin.
- [ ] Manual smoke: add a custom hostname via the API, set the TXT record,
      hit `POST /api/domains/[id]/verify` from a real workspace, observe
      the row transition through `pending` → `verifying` → `verified` →
      `ssl_provisioning` → `active` within ~5 minutes.
- [ ] Short link smoke: `curl -I https://gofnl.co/abc123` returns a 302 to
      the published subdomain URL.

---

## 5. Common failure modes

| Symptom                                         | Cause                                                | Fix |
| ----------------------------------------------- | ---------------------------------------------------- | --- |
| TXT verify keeps returning "not yet visible"    | TTL not yet expired, or wrong record name            | Wait 30 min. Confirm the customer set `_funnel-verify.<domain>` not just `_funnel-verify`. |
| SSL stays in `pending_validation` > 15 min      | CNAME isn't proxied / customer pointed at a CNAME that requires SNI we don't terminate | Tell them to remove proxying, or to switch to ANAME if apex. |
| Custom hostname returns 526 / 525               | Cloudflare can't validate the cert chain we present  | Ensure `edge.gofunnelai.com` has a valid SAN that includes the customer hostname (Cloudflare handles this once the hostname is added). |
| Wildcard subdomain returns the marketing site   | Worker route ordering — apex route is catching too much | Make sure the `*.gofunnelai.com/*` pattern is listed before the apex route, or split them across zones if necessary. |
