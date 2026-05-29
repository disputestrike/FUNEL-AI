# 04 — Integration Matrix & Provider Abstraction Layer (PAL)

**Status:** Source of truth for every external API GoFunnelAI talks to.
**Owners:** Platform Eng (PAL contract), Integrations Pod (adapter authors), SRE (health & limits), Compliance (DNC / VAT / region gating).
**Audience:** Engineers assigning adapters, on-call SRE, security review, vendor procurement.

This document has four parts:

- **Part A** — The PAL contract every adapter implements.
- **Part B** — The integration matrix (one row per external provider).
- **Part C** — Adapter implementation order (who builds what, when).
- **Part D** — Failure handling per high-criticality integration.

Three capability-flag values appear throughout:

| Flag | Meaning |
|---|---|
| **DIRECT** | GoFunnelAI writes/executes through the provider's official API. Full agentic control. |
| **REVIEW-GATED** | GoFunnelAI prepares the action but a human approves before the adapter executes. Used where provider TOS, regulatory rules, or risk demand a human in the loop. |
| **BRIDGED** | No write API exists (or it's restricted). We bridge through a partner, the customer's own credentials, an MCP, or a manual handoff. Capability is exposed but flagged in UI. |

---

## PART A — The Provider Abstraction Layer (PAL)

### A.1 Design principles

1. **One interface, every channel.** Ads, social, voice, payment, calendar — all conform to the same shape so the agent layer, billing layer, and retry/observability layers are channel-agnostic.
2. **Resource-typed, not endpoint-typed.** Adapters expose `create("campaign", payload)`, not `createCampaign(payload)`. The orchestrator decides what resource it wants; the adapter maps to the underlying API.
3. **Idempotent by contract.** Every write accepts an `idempotencyKey` and must dedupe on it. We replay writes on transient failure — the adapter must not double-charge or double-post.
4. **Webhook-first sync.** Pull syncs are fallback. Adapters must declare which webhook events they emit and survive replay.
5. **No silent degradation.** If a provider is down or scope is missing, the adapter throws a typed error. The orchestrator decides whether to fall back, queue, or surface to the user.
6. **Cost & quota visibility.** `limits()` is mandatory. Billing and rate-control read it; there is no "I don't know what this costs" adapter.

### A.2 The TypeScript contract

```ts
// packages/pal/src/types.ts

export type WorkspaceId = string;       // tenant
export type ResourceType =
  | "campaign" | "adset" | "ad" | "creative"
  | "post" | "comment" | "message"
  | "call" | "sms"
  | "subscription" | "invoice" | "customer" | "payment_method"
  | "email" | "contact" | "list"
  | "event" | "booking"
  | "lead" | "audience";

export interface ConnectResult {
  connectionId: string;
  externalAccountId: string;
  scopesGranted: string[];
  expiresAt?: string;             // ISO8601
  refreshAvailable: boolean;
}

export interface StatusResult {
  connected: boolean;
  scopesGranted: string[];
  scopesMissing: string[];        // required scopes we don't have
  expiresAt?: string;
  lastSyncAt?: string;
  lastWebhookAt?: string;
  degraded: boolean;              // true when usable but limited
  degradedReason?: string;
}

export interface WriteOptions {
  idempotencyKey: string;         // required on every write
  reviewGated?: boolean;          // when true, adapter MUST stage, not execute
  dryRun?: boolean;               // validate only
}

export interface ListFilters {
  cursor?: string;
  limit?: number;
  since?: string;                 // ISO8601
  until?: string;
  status?: string;
  q?: string;
}

export interface ListResult<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

export interface WebhookEvent {
  id: string;                     // adapter-assigned, stable for replay
  type: string;                   // e.g. "campaign.spend.updated"
  resource: ResourceType;
  resourceId?: string;
  occurredAt: string;
  payload: unknown;
  raw?: unknown;                  // original provider body for audit
}

export interface ProviderLimits {
  rateLimit: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerDay?: number;
    burstBucket?: number;
  };
  dailyQuota?: { calls?: number; tokens?: number; cost?: number };
  monthlyCost?: {
    estimatedUSD: number;        // our forecast
    capUSD?: number;             // workspace-level hard cap
  };
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
  upstream?: "up" | "degraded" | "down";
  notes?: string;
}

export interface ProviderAdapter {
  readonly providerKey: string;            // e.g. "meta-ads"
  readonly version: string;                // semver of this adapter
  readonly supportedResources: ResourceType[];
  readonly capabilityFlag: "DIRECT" | "REVIEW-GATED" | "BRIDGED";

  // --- Lifecycle ---
  connect(workspaceId: WorkspaceId, oauthCallbackUrl: string): Promise<ConnectResult>;
  disconnect(workspaceId: WorkspaceId): Promise<void>;
  status(workspaceId: WorkspaceId): Promise<StatusResult>;

  // --- CRUD + lifecycle ---
  create<T = unknown>(resource: ResourceType, payload: unknown, opts: WriteOptions): Promise<T>;
  read<T = unknown>(resource: ResourceType, id: string): Promise<T>;
  update<T = unknown>(resource: ResourceType, id: string, payload: unknown, opts: WriteOptions): Promise<T>;
  delete(resource: ResourceType, id: string, opts: WriteOptions): Promise<void>;
  pause(resource: ResourceType, id: string, opts: WriteOptions): Promise<void>;
  resume(resource: ResourceType, id: string, opts: WriteOptions): Promise<void>;
  list<T = unknown>(resource: ResourceType, filters: ListFilters): Promise<ListResult<T>>;

  // --- Sync & webhooks ---
  sync(workspaceId: WorkspaceId, since?: string): Promise<{ events: WebhookEvent[]; nextSince: string }>;
  webhookVerify(headers: Record<string, string>, body: string | Buffer): boolean;
  webhookHandle(verifiedPayload: unknown): Promise<WebhookEvent[]>;
  replay(webhookEventId: string): Promise<WebhookEvent[]>;

  // --- Ops ---
  limits(): ProviderLimits;
  healthCheck(): Promise<HealthCheckResult>;
}
```

### A.3 Error class hierarchy

All errors thrown by adapters inherit from `ProviderError`. The retry layer dispatches on subclass.

```ts
// packages/pal/src/errors.ts

export class ProviderError extends Error {
  constructor(
    public providerKey: string,
    public code: string,                    // adapter-defined stable code
    message: string,
    public httpStatus?: number,
    public raw?: unknown,
    public retryable: boolean = false,
    public retryAfterSec?: number,
  ) { super(message); }
}

// Caller should back off and retry; payload was valid.
export class TransientError extends ProviderError {
  constructor(p: string, c: string, m: string, status?: number, raw?: unknown, retryAfter?: number) {
    super(p, c, m, status, raw, true, retryAfter);
  }
}

// Provider says slow down. Honor retryAfterSec if present.
export class RateLimitError extends TransientError {}

// Auth/refresh failed. Caller must prompt re-connect; do NOT retry blindly.
export class AuthError extends ProviderError {
  constructor(p: string, c: string, m: string, status?: number, raw?: unknown) {
    super(p, c, m, status, raw, false);
  }
}

// Resource doesn't exist or was deleted upstream. Don't retry; reconcile.
export class NotFoundError extends ProviderError {
  constructor(p: string, c: string, m: string, raw?: unknown) {
    super(p, c, m, 404, raw, false);
  }
}

// Payload, policy, or scope is wrong. Don't retry; surface to user.
export class PermanentError extends ProviderError {
  constructor(p: string, c: string, m: string, status?: number, raw?: unknown) {
    super(p, c, m, status, raw, false);
  }
}
```

### A.4 Retry policy

The PAL ships a single retry helper that **every adapter must route writes through**. Adapters do not implement their own retry loops.

| Error class | Default policy |
|---|---|
| `RateLimitError` | Honor `retryAfterSec`. If absent, exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (cap 60s). Max 6 attempts. Jitter +/- 25%. |
| `TransientError` (non-rate-limit) | Exponential backoff 500ms base, factor 2, cap 30s, max 5 attempts, full jitter. |
| `AuthError` | One refresh attempt via stored refresh token. If still failing, mark connection `degraded`, emit `connection.expired` event, surface to UI. **No retry of the failed write.** |
| `NotFoundError` | No retry. Emit reconciliation event so the orchestrator can refresh its view of upstream state. |
| `PermanentError` | No retry. Send to dead-letter queue (`pal.dlq.<providerKey>`) with full request envelope for engineer review. |

Writes are dedup'd by `idempotencyKey` at the orchestrator level (Postgres unique constraint) **and** at the adapter level when the provider supports it (Stripe `Idempotency-Key`, Meta `client_request_id`, Twilio `CallSid` pre-allocation, etc.). Adapters that have no provider-side idempotency MUST persist `idempotencyKey -> externalId` in their own KV namespace before returning success.

### A.5 Webhook handling rules

1. **Verify before parsing.** `webhookVerify()` must run before `webhookHandle()`. Unverified payloads are dropped and logged as security events.
2. **Persist raw body for 30 days** in R2 keyed by `webhook_event_id` to enable `replay()`.
3. **Deliver-at-least-once internally.** `webhookHandle()` returns events into BullMQ; downstream consumers must be idempotent on `event.id`.
4. **Replay is operator-only.** `replay()` is reachable only from the admin console, never from customer-facing surfaces.

### A.6 Observability requirements

Every adapter call emits one OTel span with attributes: `provider.key`, `provider.version`, `resource`, `op`, `workspace.id`, `idempotency_key` (hashed), `result` (`ok` / `error_class`), `latency_ms`, `cost_usd_estimate` (if known). Spans feed Grafana dashboards keyed by `provider.key` and Sentry breadcrumbs on error.

---

## PART B — The Integration Matrix

Column legend:

- **Cap** = capability flag (DIRECT / REVIEW-GATED / BRIDGED).
- **Pri** = launch priority (D90 / M3 / M6 / M12).
- **Owner** = role responsible for the adapter.
- **Fallback** = degraded path when this provider fails.

### B.1 LLM / AI

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Anthropic Claude** | Primary reasoning, agent loop, content gen, JSON tool-calls | API key (workspace-scoped, vault-stored) | `POST /v1/messages`, `POST /v1/messages?stream=true`, `POST /v1/messages/batches`, files API, prompt caching headers | None (polling on batches) | 50 RPM Tier 1 -> 4000 RPM Tier 4; per-workspace soft cap 1M tokens/day default | OpenAI (degraded mode: shorter context, lower-quality plan output) | DIRECT | D90 | AI Platform | ~$3/Mtok in / $15/Mtok out Sonnet; cache-first prompts cut 60-80% on repeat planning | Global; data residency via Anthropic on AWS US/EU |
| **OpenAI** | Realtime API for voice onboarding (WebRTC), fallback chat model, embeddings (`text-embedding-3-large`) | API key | `POST /v1/realtime/sessions`, `wss://api.openai.com/v1/realtime`, `POST /v1/chat/completions`, `POST /v1/embeddings` | None | Tier-based; voice onboarding capped at 30 concurrent sessions on D90 | Anthropic (text) / ElevenLabs+Whisper (voice path) | DIRECT | D90 | AI Platform | Realtime ~$0.06/min audio in + $0.24/min out; budget $0.40/onboarding session | Global |
| **Flux / Ideogram (via Replicate)** | Ad creative imagery, brand-styled hero shots | Replicate API token | `POST /v1/predictions`, `GET /v1/predictions/{id}` | Replicate webhook on completion (HMAC-signed) | 10 concurrent predictions per workspace | Direct Flux API; last resort: stock library | DIRECT | M3 | Creative Pod | ~$0.003-0.04/image depending on model; cap 200 images/workspace/day | Global |
| **Runway / Veo** | Short-form video ad gen (6-12s) | Runway API key; Veo via Google Vertex | Runway `POST /v1/image_to_video`; Vertex `predict` on `veo-*` | Polling | 5 concurrent jobs per workspace | Each other; static-image fallback if both down | REVIEW-GATED | M6 | Creative Pod | $0.05-0.50/sec video; hard cap $50/workspace/day default | Veo Vertex regions: us-central1, europe-west4 |
| **ElevenLabs** | TTS, voice cloning for personas, multilingual voice for outbound | API key | `POST /v1/text-to-speech/{voice_id}`, `POST /v1/voices/add`, streaming endpoints | None | Plan-tier concurrency (Creator: 5, Pro: 10, Scale: 15) | OpenAI TTS, then Azure Speech | DIRECT | D90 | Voice Pod | ~$0.18/1k chars Pro tier; voice clones $1-22/mo each | Global; EU residency option on Enterprise |
| **Whisper (OpenAI)** | Call transcription, KB ingestion (YouTube), inbound voicemail | OpenAI API key | `POST /v1/audio/transcriptions` | None | Tier-based | Self-hosted faster-whisper on Workers AI; Deepgram (M6) | DIRECT | D90 | Voice Pod | ~$0.006/min; ~$0.001/min self-hosted | Global |

### B.2 Ads

| Provider | Purpose | Auth (scopes) | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Meta Marketing API** (FB + IG) | Campaign/adset/ad CRUD, audiences, insights, lead ads | OAuth2 — `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, `pages_manage_ads`, `leads_retrieval`, `instagram_basic`, `instagram_manage_insights` | `/act_{id}/campaigns`, `/act_{id}/adsets`, `/act_{id}/ads`, `/{ad_account}/insights`, `/{form_id}/leads` | Lead Ads webhook (`leadgen`), Page webhooks, Ad Account webhooks (`account_review`, `delivery`) | Per-app + per-user BUC; budget 200 score/hr per ad account, batch where possible | Google Ads (cross-network rebalance) | DIRECT | D90 | Ads Pod | $0 platform fee; ad spend pass-through | EU: GDPR-required CAPI; LATAM/IN no local restriction |
| **Google Ads API** | Search + PMax + Demand Gen campaigns, conversion uploads, keyword research | OAuth2 — `https://www.googleapis.com/auth/adwords`; developer token required (Basic -> Standard access) | `customers:searchStream`, `customers/{id}/campaigns:mutate`, `customers/{id}/googleAds:search`, conversion upload | None (polling reports) | 15k ops/day Basic, 40 QPS Standard | Meta Ads | DIRECT | D90 | Ads Pod | Platform fee $0; need Standard access approval (5-10 business days) | Global; CN excluded |
| **TikTok Ads API** | Campaign CRUD on TikTok for Business | OAuth2 — `Ad Account Management`, `Audience Management`, `Reporting`, `Lead Generation` | `/open_api/v1.3/campaign/create/`, `/adgroup/create/`, `/ad/create/`, `/report/integrated/get/`, `/lead/list/` | Lead webhook, Auth-status webhook | 10 QPS per advertiser; 1200 req/min app-wide | Meta (Reels) | DIRECT | M3 | Ads Pod | $0 platform fee | Excluded in US for federal devices; not used for gov customers |
| **LinkedIn Marketing API** | Sponsored Content, Lead Gen Forms, Conversation Ads | OAuth2 (3-legged) — `r_ads`, `rw_ads`, `r_ads_reporting`, `r_organization_social`, `w_organization_social`, `r_marketing_leadgen_automation` | `/rest/adAccounts/{id}/adCampaigns`, `/rest/adAccounts/{id}/adCampaignGroups`, `/rest/leadFormResponses`, `/rest/adAnalytics` | LinkedIn Lead Sync webhook (when allowlisted) | 100 req/sec/app, 500k/day | Manual CSV export | DIRECT | M3 | Ads Pod | App must pass LinkedIn Marketing Developer Platform review | Global |
| **X Ads API** | Sponsored posts on X | OAuth 1.0a — Ads API access tier required | `/12/accounts/{id}/campaigns`, `/12/accounts/{id}/line_items`, `/12/stats/accounts/{id}` | None | Tier-based; Basic 100/15min, Pro higher | None (skip channel) | REVIEW-GATED | M6 | Ads Pod | Pro tier $5k/mo; defer until customer demand | Global |
| **Pinterest Ads** | Catalog and search ads, especially e-comm | OAuth2 — `ads:read`, `ads:write`, `catalogs:read`, `catalogs:write` | `/v5/ad_accounts/{id}/campaigns`, `/v5/ad_accounts/{id}/ad_groups`, `/v5/ad_accounts/{id}/ads`, `/v5/ad_accounts/{id}/reports` | None | 1000 req/min default | Meta (cross-network) | DIRECT | M6 | Ads Pod | $0 platform | Global |
| **Snap Ads** | Snap campaign mgmt | OAuth2 — `snapchat-marketing-api` | `/v1/adaccounts/{id}/campaigns`, `/v1/adaccounts/{id}/adsquads`, `/v1/adaccounts/{id}/ads`, `/v1/stats` | None | 5000 req/min | None | BRIDGED | M12 | Ads Pod | Low priority; carry as flag | Global except CN |
| **Reddit Ads** | Reddit campaign mgmt | OAuth2 — `adsread`, `adsedit` | `/api/v3/ad_accounts/{id}/campaigns`, `/api/v3/ad_accounts/{id}/ad_groups`, `/api/v3/ad_accounts/{id}/ads` | None | 600 req/min | None | BRIDGED | M12 | Ads Pod | Carry as flag until US/EN customer pull | Global |

### B.3 Social posting

| Provider | Purpose | Auth (scopes) | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Meta Graph (FB pages + IG)** | Organic posts, IG Reels, comments, DMs | OAuth2 — `pages_show_list`, `pages_manage_posts`, `pages_manage_engagement`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages` | `/{page_id}/feed`, `/{page_id}/photos`, `/{ig_user_id}/media`, `/{ig_user_id}/media_publish`, `/{post_id}/comments` | Page Mention, Comment, Messenger webhooks | 200 calls/hr/user BUC | Buffer-style queue | DIRECT | D90 | Social Pod | $0 | Global |
| **LinkedIn API** | Organic company posts, comments | OAuth2 — `w_member_social`, `w_organization_social`, `r_organization_social` | `/rest/posts`, `/rest/socialActions/{urn}/comments` | None (poll comments) | 500 posts/day/org | Manual | DIRECT | M3 | Social Pod | $0 | Global |
| **X API v2** | Organic posts, replies, mention sync | OAuth 2.0 + PKCE — `tweet.read`, `tweet.write`, `users.read`, `offline.access` | `POST /2/tweets`, `GET /2/users/{id}/mentions`, `POST /2/tweets/search/stream` (Pro+) | Filtered Stream (Pro+) | Tier-based: Basic 100 tweets/24hr, Pro 100k/mo | None | REVIEW-GATED | M3 | Social Pod | Basic $200/mo; Pro $5k/mo (only if customer requests stream) | Global |
| **TikTok Content Posting** | Direct post + draft to TikTok | OAuth2 — `video.upload`, `video.publish`, `user.info.basic` | `/v2/post/publish/video/init/`, `/v2/post/publish/status/fetch/`, `/v2/post/publish/inbox/video/init/` | None (poll status) | 6 posts/24hr/user (TT cap) | Draft-to-inbox mode | DIRECT | M3 | Social Pod | $0 | Excluded for US gov-device customers |
| **YouTube Data API** | Upload Shorts, retrieve transcripts (KB), playlist mgmt | OAuth2 — `youtube.upload`, `youtube`, `youtube.readonly`, `youtube.force-ssl` | `videos.insert` (resumable), `captions.download`, `channels.list`, `search.list` | PubSubHubbub for new uploads | 10k quota units/day default; 1 upload = 1600 units | Manual export | DIRECT | M3 | Social Pod | Free; request quota raise pre-launch | Global; CN N/A |
| **Pinterest** | Organic Pin publishing | OAuth2 — `boards:read`, `boards:write`, `pins:read`, `pins:write` | `/v5/pins`, `/v5/boards` | None | 1000 req/min | Manual | DIRECT | M6 | Social Pod | $0 | Global |
| **Threads** | Cross-post from IG composer | Meta Graph OAuth — `threads_basic`, `threads_content_publish`, `threads_manage_replies` | `/v1.0/me/threads`, `/v1.0/{id}/threads_publish` | Threads webhook (limited) | Tied to Meta BUC | Skip channel | DIRECT | M6 | Social Pod | $0 | EU rollout incomplete — gate by region |

### B.4 Voice / SMS

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **RevTry** (our company) | Primary outbound + inbound voice, AI voice agent, recording, sentiment, transfer | Internal mTLS + JWT | `POST /v1/calls`, `POST /v1/agents`, `GET /v1/calls/{id}/recording`, `POST /v1/numbers/provision` | RevTry webhooks: `call.initiated`, `call.answered`, `call.completed`, `call.transcript`, `call.sentiment`, `number.message_received` | 100 concurrent calls/workspace default; soft-burst to 500 with notice | Twilio Programmable Voice | DIRECT | D90 | Voice Pod (internal) | Internal cost basis; charged at carrier+margin | US/CA/UK/AU/DE/BR launch regions; expand quarterly |
| **Twilio Programmable Voice** | Failover voice when RevTry degraded; carrier ops where RevTry not yet licensed | Account SID + Auth Token | `POST /2010-04-01/Accounts/{sid}/Calls`, `<Response><Dial>...` TwiML | Voice webhook (`StatusCallback`), recording webhook | 1 CPS default per number; raise via tickets | RevTry queue with retry | DIRECT | D90 | Voice Pod | ~$0.014/min US outbound; tollfree higher | Global except sanctioned |
| **Twilio Lookup** | Phone-number validation, line type (mobile/landline/voip), carrier, caller name | Account SID + Auth Token | `GET /v2/PhoneNumbers/{e164}?Fields=line_type_intelligence,caller_name,identity_match` | None | 100 RPS | Numverify | DIRECT | D90 | Compliance | $0.005-0.04/lookup depending on packet | Global |
| **Twilio SMS** | Lead nurture, OTP fallback, appointment reminders | Account SID + Auth Token | `POST /2010-04-01/Accounts/{sid}/Messages` | Message status, inbound | 1 MPS long-code, 100 MPS shortcode | RevTry SMS (when shipped) | DIRECT | D90 | Voice Pod | ~$0.0079/SMS US; A2P 10DLC registration required | A2P 10DLC US; SMS reg by region |

### B.5 Payment

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **PayPal Subscriptions** (primary) | Subscription billing, recurring plans, one-tap upsells | OAuth2 client credentials | `/v1/billing/plans`, `/v1/billing/subscriptions`, `/v2/payments/captures` | Webhook events: `BILLING.SUBSCRIPTION.*`, `PAYMENT.CAPTURE.*` (verified via `verify-webhook-signature`) | 50 RPS default | Stripe | DIRECT | D90 | Billing Pod | ~2.9% + $0.30; cross-border surcharge | Global; not used in IN for recurring (NPCI restrictions) -> Stripe |
| **Stripe Billing + Tax + Checkout** | Secondary subscription rail, automatic tax, regional methods, dunning, customer portal | Restricted API key + webhook secret | `/v1/customers`, `/v1/subscriptions`, `/v1/checkout/sessions`, `/v1/invoices`, Tax `/v1/tax/calculations` | `customer.subscription.*`, `invoice.*`, `checkout.session.completed` (Stripe-Signature header) | 100 read/sec, 100 write/sec | Paddle (MoR) | DIRECT | D90 | Billing Pod | 2.9% + $0.30 US; +1% international; Tax $0.50/calc cap | Global; CN via WeChat/Alipay |
| **Paddle** | Merchant-of-Record alternative for Agency tier (handles tax globally) | API key | `/customers`, `/subscriptions`, `/transactions`, hosted checkout | `subscription.*`, `transaction.*` (HMAC-signed) | 480 req/min | Stripe | DIRECT | M3 | Billing Pod | 5% + $0.50/transaction (MoR premium) | Global; preferred for VAT-heavy EU agencies |
| **Pix** (Brazil) | Instant BR payments | Via PSP (e.g., Stripe BR or local PSP) | PSP-specific | PSP webhook | PSP-defined | Card | DIRECT | M3 | Billing Pod / LATAM | ~0.99% via Stripe | BR only |
| **UPI** (India) | Recurring + one-time IN | Razorpay or Stripe IN | PSP-specific | PSP webhook | PSP-defined | Card | DIRECT | M3 | Billing Pod / APAC | ~2% via Razorpay; UPI Autopay caps apply | IN only; NPCI rules |
| **SEPA** | EU bank debit | Via Stripe `sepa_debit` PM | `/v1/payment_methods`, `/v1/setup_intents` | `payment_intent.*` | Stripe limits | Card | DIRECT | M3 | Billing Pod | 0.8% capped EUR 5 | EU only |
| **OXXO** | MX cash voucher | Via Stripe `oxxo` PM | `/v1/payment_intents` | `payment_intent.requires_action`, `succeeded` | Stripe limits | Card | DIRECT | M6 | LATAM | 3.6% + MXN 3 | MX only |
| **Alipay** | CN consumer | Via Stripe or Alipay direct | PSP-specific | PSP webhook | PSP-defined | None | BRIDGED | M12 | APAC | ~2.5% | CN only; requires CN entity for direct |
| **M-Pesa** | KE/TZ mobile money | Daraja API (Safaricom) | `/mpesa/stkpush/v1/processrequest`, `/mpesa/c2b/v2/registerurl` | C2B confirmation webhook | 1 TPS sandbox, ~10 TPS prod | Card | BRIDGED | M12 | EMEA | 1-3% transaction; requires KE business reg | KE/TZ |

### B.6 Email

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **SendGrid** (primary) | Transactional + nurture sequences, dedicated IPs, suppression mgmt | API key (scoped) | `POST /v3/mail/send`, `/v3/marketing/contacts`, `/v3/suppression/*`, `/v3/user/webhooks/event/settings` | Event Webhook (delivered/open/click/bounce/spamreport/unsubscribe), signed with Ed25519 | 600 emails/sec on Pro; 10k recipients/request | Resend | DIRECT | D90 | Email Pod | Pro $89.95/mo + overage; dedicated IP $80/mo | SPF/DKIM/DMARC per sending domain required at onboarding |
| **Resend** (failover) | Failover for transactional bursts, dev DX preferred for templates | API key | `POST /emails`, `POST /audiences/{id}/contacts`, `POST /broadcasts` | Webhook events: `email.sent`, `delivered`, `bounced`, `complained` (Svix-signed) | 10 req/sec default; raise per account | SendGrid | DIRECT | D90 | Email Pod | $20/mo 50k emails; pay-as-you-go after | Same SPF/DKIM/DMARC bundle reused |

**Auth-domain setup:** every workspace gets a signing subdomain (`mail.{workspace}.gofunnelai.com`). At connect time we provision SPF (`v=spf1 include:sendgrid.net include:resend.com -all`), DKIM CNAMEs (two per provider), and DMARC (`p=quarantine` ramping to `p=reject`). Adapter `connect()` fails closed if DNS not propagated within 24h.

### B.7 Brand autofill / Enrichment

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Clearbit Logo API** | Logo by domain | None (public) | `https://logo.clearbit.com/{domain}` | None | 600 req/min (community) | Brandfetch | DIRECT | D90 | Onboarding Pod | Free (community); we cache to R2 | Global |
| **WhoisXML** | Domain owner / registration date / tech stack signals | API key | `/whoisserver/WhoisService`, `/EmailVerification/*` | None | Plan-tier | DomainTools | DIRECT | M3 | Enrichment Pod | $0.001-0.01/lookup | Global |
| **LinkedIn Company API** | Company size, industry, headcount trend (limited scopes) | OAuth2 — `r_organization_admin`, `r_1st_connections_size` | `/rest/organizations/{id}`, `/rest/organizationAcls` | None | 500 req/day/app | Crunchbase | BRIDGED | M3 | Enrichment Pod | Requires LinkedIn partner approval | Global |
| **Crunchbase** | Funding, founding date, key people | API key | `/api/v4/entities/organizations/{id}`, `/api/v4/searches/organizations` | None | Plan-tier (Pro: 200 req/min) | Manual | DIRECT | M6 | Enrichment Pod | Crunchbase Pro $49/user/mo for low-tier; Enterprise required for full API | Global |
| **Google Business Profile API** | Local listings, reviews, hours, posts | OAuth2 — `https://www.googleapis.com/auth/business.manage` | `/v4/accounts/{id}/locations`, `/v1/accounts/{id}/locations/{lid}/reviews:reply` | None (poll reviews) | 600 req/min/project | Manual | DIRECT | M3 | Enrichment Pod | Free; requires GBP API allowlisting (4-8 wks) | Global |
| **Meta Ad Library API** | Competitor ad creative scraping for brand brief | App access token | `/{version}/ads_archive`, search by `search_terms` and `ad_reached_countries` | None | 200 req/hr/app BUC | Manual | DIRECT | M3 | Enrichment Pod | Free; EU/political ads broader scope | Global; political ads region-restricted |
| **Google Ad Transparency Center** | Competitor PMax/Search ad inspection | None — public scraping w/ robots.txt respect | Public URL patterns | None | Scrape budget 100/hr/workspace | Manual | BRIDGED | M6 | Enrichment Pod | $0; legal review required quarterly | Global |

### B.8 Calendar

| Provider | Purpose | Auth (scopes) | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Google Calendar** | Booking, availability, event create | OAuth2 — `https://www.googleapis.com/auth/calendar.events`, `calendar.readonly` | `/calendar/v3/calendars/{id}/events`, `/calendar/v3/freebusy` | Push notifications via `events.watch` (channel) | 1M req/day project default | Cal.com | DIRECT | D90 | Booking Pod | Free | Global |
| **Microsoft Graph Calendar** | Booking for M365 customers | OAuth2 — `Calendars.ReadWrite`, `MailboxSettings.Read` | `/v1.0/me/events`, `/v1.0/me/calendar/getSchedule` | Subscriptions (clientState validated) | 10k req/10min per app per tenant | Cal.com | DIRECT | M3 | Booking Pod | Free; some tenants require admin consent | Global |
| **Cal.com** | Hosted booking pages, round-robin team scheduling | API key + OAuth (Platform plan) | `/v2/bookings`, `/v2/event-types`, `/v2/availability` | Webhook on booking created/cancelled/rescheduled (HMAC) | 100 req/min | Native GoFunnelAI scheduler | DIRECT | M3 | Booking Pod | Free OSS or Platform tier ~$15/user/mo | Global; self-hostable for EU residency |
| **Calendly** (fallback) | When prospect already uses Calendly, embed read-only | OAuth2 — `default` (read), `read_write` (write tier) | `/scheduled_events`, `/event_types`, `/users/me` | Webhook subscriptions (signed) | 1000 req/min | None | DIRECT | M6 | Booking Pod | Standard plan API access; webhook subs paid tier | Global |

### B.9 KB freshness ingestion

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **NewsAPI.org** | Industry news, competitor mentions | API key | `/v2/everything`, `/v2/top-headlines` | None | Developer 100/day; Business 250k/mo | GDELT, Bing News | DIRECT | M3 | KB Pod | Business $449/mo | Global |
| **YouTube Data API** | Channel video listings + transcripts | OAuth2 — `youtube.readonly`, `youtube.force-ssl` for captions | `search.list`, `videos.list`, `captions.download` | PubSubHubbub | Shared 10k/day quota | yt-dlp self-hosted (legal review) | DIRECT | M3 | KB Pod | Free | Global |
| **Reddit API** | Subreddit signal for KB and audience research | OAuth2 — `read`, `wikiread` (script app for read-only) | `/r/{sub}/new`, `/r/{sub}/about`, `/search` | None | 100 QPM auth, 10 QPM unauth | Pushshift (rate-limited) | DIRECT | M3 | KB Pod | Free tier post-2023; Enterprise paid if commercial use threshold hit | Global |
| **Custom RSS scraping** | Customer-supplied feeds; competitor blogs | None (public) | Fetch w/ ETag/Last-Modified | None | 1 req per 5 min per feed; respect `robots.txt` and `Crawl-delay` | None | DIRECT | D90 | KB Pod | $0 | Global; obey site TOS |

### B.10 Compliance / verification

| Provider | Purpose | Auth | Key endpoints | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **VIES** | EU VAT number validation at checkout | None | `https://ec.europa.eu/taxation_customs/vies/services/checkVatService` (SOAP) | None | ~10 req/sec polite; instability common | Stripe Tax fallback validation | DIRECT | M3 | Compliance | Free | EU only |
| **DNC list APIs** | US National DNC scrub, state DNC, internal DNC | DNC.gov SAN account + state SANs | `https://telemarketing.donotcall.gov/`, state-specific | None | Per SAN limits | Internal DNC list only (degraded) | DIRECT | D90 | Compliance | Per SAN annual fee; ~$83/area code/yr US | US (federal + state); UK TPS; CA CRTC; AU DNCR |
| **Cloudflare Turnstile** | Bot/spam protection on signup + lead-form embed | Site key + secret key | `https://challenges.cloudflare.com/turnstile/v0/siteverify` | None | Unlimited (free) | hCaptcha | DIRECT | D90 | Security | Free | Global |

### B.11 Storage / infra

| Provider | Purpose | Auth | Key endpoints / SDKs | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Edge compute, adapter execution surface | API token + service bindings | Wrangler deploys; `fetch()` runtime | Tail Workers for logs | 1000 sub-requests/invocation; 50ms CPU default, 30s on paid plans | None (core platform) | DIRECT | D90 | Platform | $5/mo + $0.30/Mreq | Global edge |
| **Cloudflare R2** | Object storage (recordings, raw webhooks, creative assets) | S3-compatible keys | S3 API | Event notifications -> Queues | 10 GB/s read | None | DIRECT | D90 | Platform | $0.015/GB-mo; $0 egress | Auto-distributed; jurisdiction labels available |
| **Cloudflare Queues** | Internal job bus complementing BullMQ for edge-originated work | API token | `producer.send()`, `consumer` Workers | Internal | 5000 msg/sec per queue | BullMQ direct | DIRECT | D90 | Platform | $0.40/M operations | Global |
| **Cloudflare KV** | Hot config, OAuth state, idempotency cache | API token | KV namespace bindings | None | 1000 writes/sec/namespace, unlimited reads | Postgres | DIRECT | D90 | Platform | $0.50/M reads, $5/M writes | Global eventually-consistent |
| **Postgres (Supabase or Neon)** | Source of truth (workspaces, connections, leads, jobs, audit) | Connection string + RLS | psql / pg drivers | Logical replication for CDC | Plan-tier; pgbouncer fronted | None | DIRECT | D90 | Platform | Neon Scale or Supabase Pro starting ~$25-69/mo per environment, scales with storage and compute | EU & US regions selectable per workspace |
| **BullMQ on Redis** | Job queue for retries, scheduled posts, sync jobs | Redis URL + ACL | BullMQ SDK | Bull events | Plan-tier | Cloudflare Queues | DIRECT | D90 | Platform | Upstash Redis pay-per-request | EU & US |

### B.12 Observability

| Provider | Purpose | Auth | Key endpoints / SDKs | Webhooks in | Rate budget | Fallback | Cap | Pri | Owner | Cost notes | Region |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Sentry** | Error tracking, perf, releases | DSN + auth token | `@sentry/node`, `@sentry/cloudflare`, `/api/0/projects/{org}/{proj}/events/` | Webhook alerts to Slack/PagerDuty | Plan event quota | Local log buffer | DIRECT | D90 | SRE | Business $80/mo + event overage | EU residency available |
| **Prometheus** | Metrics scrape from internal services | mTLS within VPC | `/metrics` exposition | None | N/A | Datadog (M12) | DIRECT | D90 | SRE | Self-hosted | N/A |
| **Grafana** | Dashboards on Prometheus + OTel + Loki | OIDC SSO | Grafana Cloud API | Alertmanager -> PagerDuty | N/A | None | DIRECT | D90 | SRE | Grafana Cloud Pro ~$8/user/mo + usage | EU & US |
| **OpenTelemetry Collector** | Unified tracing/metric/log pipeline | mTLS | OTLP gRPC/HTTP | None | N/A | Direct Sentry export | DIRECT | D90 | SRE | Self-hosted | N/A |

---

## PART C — Adapter implementation order

Sequence reflects what must exist for the Day-90 launch (autonomous lead-gen MVP: connect brand -> generate creative -> launch ad -> capture lead -> book call -> charge subscription), then what we layer on for Month 3-6 (channel breadth and global payments), then what stays behind a capability flag until customer pull justifies it.

### C.1 First 10 adapters (Day 90 critical path)

These are the absolute minimum to ship the loop "from prospect signup to first revenue." Each gets a named owner before sprint zero.

| # | Adapter | Why it's day-1 | Owner |
|---|---|---|---|
| 1 | **Anthropic Claude** | Core agent reasoning; everything else routes through it. | AI Platform — Lead Eng |
| 2 | **Postgres** (Supabase or Neon) | Source-of-truth tables for workspaces, connections, jobs. | Platform — Lead Eng |
| 3 | **Cloudflare R2 + Queues + KV** | Storage + intra-platform bus + idempotency cache. Shipped as one PAL package. | Platform — Lead Eng |
| 4 | **Stripe Billing + Tax + Checkout** | Subscription rail and tax. PayPal lands same sprint but Stripe boots the billing tests. | Billing Pod — Lead Eng |
| 5 | **PayPal Subscriptions** | Primary subscription rail per spec. | Billing Pod — Eng 2 |
| 6 | **Meta Marketing API** | Largest ad surface; lead-ads form is the primary lead capture on launch. | Ads Pod — Lead Eng |
| 7 | **Google Ads API** | Second ad surface; required for cross-network agent decisions. Long lead time on Standard-access approval — start vendor process Day 0. | Ads Pod — Eng 2 |
| 8 | **SendGrid** (with Resend failover stub) | Transactional + nurture; auth-domain provisioning gates onboarding. | Email Pod — Lead Eng |
| 9 | **RevTry** | Primary voice; AI agent dialing is a launch differentiator. | Voice Pod — Lead Eng (internal) |
| 10 | **Google Calendar** | Booking surface for first-call conversion. | Booking Pod — Lead Eng |

**Day-90 supporting adapters** (built in parallel, lighter scope):
- Anthropic + OpenAI (voice onboarding) — same AI Platform pod.
- Twilio Programmable Voice + Lookup + SMS — needed as RevTry failover and for phone validation pre-call. Voice Pod — Eng 2.
- ElevenLabs + Whisper — Voice Pod — Eng 3.
- Meta Graph organic — Social Pod (reuses Meta OAuth from Ads).
- Cloudflare Turnstile — Security.
- DNC list — Compliance. **Non-negotiable**: outbound calls cannot ship without it.
- Clearbit Logo — Onboarding Pod.
- Sentry + Prometheus + Grafana + OTel — SRE bring-up Week 1.

### C.2 Next 10 adapters (Month 3-6)

Channel breadth, global payment rails, and the enrichment layer that lets the agent reason about brand and competitor context.

| # | Adapter | Trigger | Owner |
|---|---|---|---|
| 11 | **LinkedIn Marketing API** | B2B customer cohort hits 20% of book. | Ads Pod |
| 12 | **TikTok Ads + Content Posting** | Bundled; required for DTC cohort. | Ads Pod / Social Pod |
| 13 | **LinkedIn organic posting** | Pairs with LinkedIn Marketing. | Social Pod |
| 14 | **YouTube Data API** | Shorts upload + KB transcript ingest. | Social Pod / KB Pod |
| 15 | **Microsoft Graph Calendar** | First enterprise/M365 customers. | Booking Pod |
| 16 | **Cal.com** | Round-robin + team scheduling tier feature. | Booking Pod |
| 17 | **Paddle** | Agency-tier MoR launch. | Billing Pod |
| 18 | **Regional payment rails** (Pix, UPI, SEPA) | Tied to LATAM/EU/IN go-to-market waves. | Billing Pod regional sub-leads |
| 19 | **Google Business Profile** | Local-business cohort and review automation. | Enrichment Pod |
| 20 | **NewsAPI + Reddit + RSS + Meta Ad Library + WhoisXML** | Enrichment + KB freshness bundle; ships as one PAL package. | Enrichment Pod / KB Pod |
| 21 | **Flux/Ideogram via Replicate** | Image-gen ad creative graduates from prototype. | Creative Pod |
| 22 | **VIES** | EU agency customers needing VAT validation. | Compliance |

(That's 12 — items 21 and 22 are slotted into Month 3-6 once their dependents land but don't displace the top 10.)

### C.3 Carried as capability flags

These are wired into the registry and surfaced in UI as "available on request" or "beta", but no adapter ships until customer demand warrants it.

| Provider | Flag | Reason held |
|---|---|---|
| Pinterest Ads + Pinterest organic | M6 | E-comm cohort signal needed. |
| X Ads + X organic | M6 / REVIEW-GATED | Pro tier $5k/mo unattractive without demand. |
| Snap Ads | M12 / BRIDGED | Low audience overlap on early ICP. |
| Reddit Ads | M12 / BRIDGED | Same. |
| Threads | M6 | API maturity + EU rollout gaps. |
| Calendly | M6 | Cal.com covers majority. |
| Runway / Veo | M6 / REVIEW-GATED | Cost + quality variance; human approval required. |
| Crunchbase | M6 | Replace with cheaper enrichment combo where possible. |
| LinkedIn Company API | M3 / BRIDGED | Partner approval gating. |
| OXXO | M6 | LATAM Phase 2. |
| Alipay | M12 / BRIDGED | CN entity gating. |
| M-Pesa | M12 / BRIDGED | KE entity gating. |
| Google Ad Transparency scrape | M6 / BRIDGED | Legal review cadence. |

---

## PART D — Failure handling (high-criticality only)

Each entry below covers an integration whose outage materially breaks the product. For every one: **degradation strategy** (what the platform does), **customer-visible message** (the exact copy users see), and **alert path** (how on-call learns). Lower-criticality adapters follow the default policy: PAL retry -> DLQ -> Sentry alert -> Linear ticket, no customer surface unless the customer requests the action live.

### D.1 Anthropic Claude

- **Degradation:** Orchestrator switches to OpenAI fallback model (GPT-class) within 30s of sustained 5xx. Plan-output schema is preserved; reasoning depth flagged as "reduced." Background batch jobs pause. Cache-warmed plans continue to execute.
- **Customer message:** Banner — *"Funnel's AI brain is running on a backup model right now. Decisions may be a little slower and less detailed. We'll switch back as soon as Anthropic recovers."*
- **Alert path:** Sentry health-check failure -> PagerDuty `ai-platform` rotation -> Slack `#incidents-ai`. Status page incident auto-opened after 5 min sustained.

### D.2 RevTry (voice)

- **Degradation:** Voice Pod drains in-flight calls; new calls route to Twilio Programmable Voice with TwiML bridging to our agent runtime. Recording + transcript continue (Whisper on Twilio recordings). AI persona quality flagged "limited" because RevTry's bespoke voice models aren't on Twilio path.
- **Customer message:** Toast on call dashboard — *"We're routing voice through a backup carrier while RevTry recovers. Outbound dialing continues; some advanced features (live sentiment, instant transfer) are paused."*
- **Alert path:** RevTry internal health webhook + our `healthCheck()` -> PagerDuty `voice` rotation -> Slack `#incidents-voice`. Internal RevTry incident channel auto-bridged.

### D.3 Meta Marketing API

- **Degradation:** Writes pause; reads serve from last sync cache. Lead Ads inflow continues over webhook unless Meta's webhook system is also down — if so, switch to leads-retrieval polling at 5-minute cadence. Spend pacing decisions defer to last-known-good state plus a 10% conservative trim.
- **Customer message:** Per-campaign chip — *"Meta is having issues. Your campaigns are still running but we can't make changes right now. Last updated {time}."*
- **Alert path:** Adapter error-rate threshold (5xx > 3% over 10 min) -> PagerDuty `ads` -> Slack `#incidents-ads`. Cross-check Meta Developer status page in alert.

### D.4 Google Ads API

- **Degradation:** Same pattern as Meta — pause writes, serve cached state, hold pacing decisions. Conversion uploads queue locally (Cloudflare Queues) with 14-day buffer (Google's import window).
- **Customer message:** Same chip pattern as Meta.
- **Alert path:** Same as Meta. Long outages additionally page Ads Pod lead since developer-token rotation may be the underlying cause.

### D.5 Stripe + PayPal

- **Degradation:** If **either** payment provider is down, route new subscriptions to the healthy one (customer chooses at checkout already; the down option is grayed with explanation). For existing subscribers on the down provider, dunning pauses and we extend grace period by the outage duration. Webhook backlog drains on recovery with idempotent re-reconciliation.
- **Customer message (checkout):** Inline — *"PayPal is currently unavailable. You can complete checkout with Stripe in the meantime."* (and the reverse).
- **Customer message (active sub on down provider):** Email + in-app — *"We noticed your billing provider is experiencing issues. Your service continues uninterrupted; we'll catch up on the next renewal cycle."*
- **Alert path:** Webhook backlog depth or capture-failure rate -> PagerDuty `billing` -> Slack `#incidents-billing`. Finance Slack channel auto-notified on > 1hr outage.

### D.6 SendGrid

- **Degradation:** Email Pod's send-router fails over to Resend automatically per workspace (same DKIM keys, parallel DNS provisioning). Suppression list is mirrored to Resend on hourly cadence — outage suppression deltas are reconciled on recovery to prevent over-sending bounced addresses.
- **Customer message:** Silent for most users. Workspaces with dedicated-IP setups see banner — *"Your dedicated sending IP is offline; we're sending via the failover pool. Deliverability is monitored."*
- **Alert path:** Bounce-rate or 5xx spike -> PagerDuty `email` -> Slack `#incidents-email`. Auto-open Status incident.

### D.7 Google Calendar

- **Degradation:** Reads serve from cache up to 15 minutes old. Booking writes queue and surface as "Booking confirmed; calendar invite arriving shortly" — invites are flushed on recovery. Conflict-detection falls back to GoFunnelAI's internal slot ledger which is always-on.
- **Customer message:** Booking page — *"Your booking is confirmed. Your calendar invite is on its way; this can take a few minutes."*
- **Alert path:** Watch-channel renewal failures or `events.list` 5xx -> PagerDuty `booking` -> Slack `#incidents-booking`.

### D.8 DNC list

- **Degradation:** **Outbound calling halts.** Compliance posture is non-negotiable: we do not call without a fresh scrub. Inbound continues. Outbound nurture queue holds.
- **Customer message:** Per-campaign banner — *"Outbound calls are paused while we refresh the do-not-call registry. We'll resume automatically within {ETA}. SMS and email continue."*
- **Alert path:** Compliance pager (Compliance lead + on-call SRE) -> Slack `#incidents-compliance`. Escalates to legal on outage > 4 hours.

### D.9 Postgres

- **Degradation:** Read replicas continue serving. Writes that depend on transactional consistency hold; eventual-consistency writes (analytics, webhook ingest) route to R2/Queues buffer for replay. Customer-facing dashboard switches to read-only mode.
- **Customer message:** Global banner — *"GoFunnelAI is in read-only mode while we recover a database issue. Your campaigns continue to run."*
- **Alert path:** Connection-pool saturation or replica lag -> PagerDuty `platform` (P1) -> Slack `#incidents-platform`. Status page incident opened immediately.

### D.10 Cloudflare Workers / R2 / Queues

- **Degradation:** Multi-region failover within Cloudflare is automatic. A full Cloudflare outage is a platform-down event handled per the disaster-recovery playbook (out of scope for this doc — see `09-runbooks/cf-outage.md`).
- **Customer message:** Status page only; product is down.
- **Alert path:** Cloudflare Notifications -> PagerDuty `platform` (P1) -> Slack `#incidents-platform`. Public status post within 10 min.

---

## Appendix — Adapter checklist (per new integration)

Before an adapter is allowed in `main`:

- [ ] Implements full `ProviderAdapter` interface (no `throw new Error("not implemented")` in shipped code).
- [ ] `limits()` returns real numbers, not placeholders.
- [ ] `healthCheck()` exercised in CI against sandbox.
- [ ] `idempotencyKey` strategy documented and enforced on every write.
- [ ] Webhook signature verification has unit tests with provider-supplied fixtures.
- [ ] `replay(eventId)` round-trips on a recorded event.
- [ ] Error mapping table (provider error code -> PAL error class) is in the adapter README.
- [ ] OTel span attributes match the standard.
- [ ] Secrets in vault, never in env files; rotation runbook linked.
- [ ] Region/residency constraints documented in matrix above.
- [ ] DLQ consumer wired to Sentry + Slack `#dlq-<providerKey>`.
- [ ] Capability flag declared (`DIRECT` / `REVIEW-GATED` / `BRIDGED`) and reflected in UI registry.
- [ ] Owner role assigned and listed in matrix.
