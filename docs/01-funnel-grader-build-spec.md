# Funnel Grader â€” Engineering Build Spec

**Document:** `01-funnel-grader-build-spec.md`
**Owner:** GoFunnelAI Engineering
**Status:** Approved for Build â€” Week 2 Sprint
**Target Live Date:** Day 14 (sprint end)
**Strategic Role:** Trojan Horse. Public, free tool at `gofunnelai.com/grade` that audits any landing page in 15 seconds. Captures emails, seeds a 60-day waitlist, ranks for "free funnel audit" + "[competitor] funnel checker," and converts via a "see what we'd generate instead" preview CTA. Ships BEFORE the main product.

---

## 0. TL;DR for Engineers

> Build a public URL audit tool. User pastes URL â†’ we render the page in a headless Chromium (Cloudflare Browser Rendering), screenshot it, extract DOM, run 5 specialized Claude agents in parallel, aggregate into a 0â€“100 score with 3 specific improvements, gate the full PDF behind email, and offer a "we'd generate this instead" 30-second preview funnel as the conversion path.
>
> **Stack:** Next.js 14 (App Router) on Cloudflare Pages, Workers for orchestration, Cloudflare Browser Rendering for headless Chrome, R2 for screenshots + PDFs, Postgres (Neon) + pgvector for audit storage, Claude Sonnet 4 for scoring agents (Haiku for fast paths, Opus only for preview generation).
>
> **Two engineers, two weeks, 14 daily milestones. Day 14 = public launch.**

---

## 1. User Journey

### 1.1 Happy Path (target: 15 sec total)

| Step | Time | Surface | User Action | System Action |
|---|---|---|---|---|
| 1 | 0s | `gofunnelai.com/grade` | Lands on hero, sees "Grade any landing page in 15 seconds. Free." | Page SSR'd, prefetched fonts, Lighthouse 95+ |
| 2 | 0â€“2s | URL input | Pastes URL, hits "Grade my page" | Client validates URL shape, POSTs to `/api/grade` |
| 3 | 2â€“4s | Loading screen | Sees stepper: "Rendering page... Reading copy... Checking trust signals... Scoring..." | Worker streams SSE progress events |
| 4 | 4â€“15s | â€” | (Watches stepper animate) | Browser Rendering screenshots + extracts DOM; 5 agents run in parallel; aggregator merges |
| 5 | 15s | Result page | Sees 0â€“100 score, 5 sub-scores, critique paragraph, 3 specific improvements | Result rendered client-side from streamed JSON; teaser blurs sub-score detail + PDF download |
| 6 | 15â€“30s | Email gate (soft) | Clicks "Get the full PDF report" | Modal: email field â†’ POST `/api/capture` â†’ unlocks full report + emails PDF |
| 7 | 30â€“60s | Share + preview | Sees "Share this score" (copies `gofunnelai.com/grade/s/XYZ123`) and "See what we'd generate instead â†’ " CTA | Share URL written to `share_codes`; CTA â†’ `/api/preview/generate` kicks off mini funnel |
| 8 | 60â€“90s | Preview funnel | Sees a rendered hero section tailored to their business (headline, sub, CTA, 1 testimonial slot, 1 trust badge row) | Opus agent + Sonnet copy agent â†’ HTML render in iframe |
| 9 | 90s+ | Waitlist CTA | "Want the full funnel + email sequence? Join the waitlist." | POST `/api/waitlist` (same email if captured) |

### 1.2 Edge Paths

- **Invalid URL** â†’ inline error before submit, no Worker call.
- **Page blocks bots** (403/429 from target) â†’ fallback to `og:image` + sitemap parsing, score with `confidence: "low"` flag.
- **Page > 10s to render** â†’ timeout at 12s, return partial score with `partial: true`, agents that completed still scored.
- **Repeated submission same domain by same IP** â†’ rate-limited (see Â§7), show cached result if < 24h old.
- **Email already captured** â†’ skip gate, show full report immediately, log `returning_user` event.

---

## 2. Architecture

```
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚           Cloudflare Edge (global)           â”‚
                    â”‚                                              â”‚
   User â”€â”€HTTPSâ”€â”€â–¶  â”‚  Pages: gofunnelai.com/grade (Next.js SSR)        â”‚
                    â”‚            â”‚                                  â”‚
                    â”‚            â–¼                                  â”‚
                    â”‚  Worker: grader-api                          â”‚
                    â”‚   POST /api/grade                            â”‚
                    â”‚   POST /api/capture                          â”‚
                    â”‚   POST /api/preview/generate                 â”‚
                    â”‚   GET  /api/grade/:shareCode                 â”‚
                    â”‚            â”‚                                  â”‚
                    â”‚            â”œâ”€â”€â–¶ Browser Rendering API        â”‚
                    â”‚            â”‚     (Cloudflare Workers Browser)â”‚
                    â”‚            â”‚     - screenshot                â”‚
                    â”‚            â”‚     - DOM snapshot              â”‚
                    â”‚            â”‚     - Lighthouse audit          â”‚
                    â”‚            â”‚                                  â”‚
                    â”‚            â”œâ”€â”€â–¶ R2: screenshots/, pdfs/      â”‚
                    â”‚            â”‚                                  â”‚
                    â”‚            â”œâ”€â”€â–¶ Queue: audit-jobs            â”‚
                    â”‚            â”‚     (Cloudflare Queues)         â”‚
                    â”‚            â”‚                                  â”‚
                    â”‚            â–¼                                  â”‚
                    â”‚  Worker: agent-runner                        â”‚
                    â”‚   - fan-out to 5 agents in parallel          â”‚
                    â”‚   - calls Claude API (Sonnet 4 / Haiku)      â”‚
                    â”‚   - aggregates â†’ writes to Postgres          â”‚
                    â”‚   - streams SSE back to client               â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                     â”‚
                              â”Œâ”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”
                              â–¼              â–¼
                       Neon Postgres    Anthropic API
                       + pgvector       (Claude Sonnet/Haiku/Opus)
```

### 2.1 Components

| Component | Tech | Responsibility |
|---|---|---|
| **Web UI** | Next.js 14 App Router on Cloudflare Pages | `/grade` page, result page, share page. RSC + client islands. |
| **`grader-api` Worker** | Cloudflare Worker (TypeScript) | Public HTTP entry. Validates input, rate-limits, enqueues, streams SSE. |
| **`agent-runner` Worker** | Cloudflare Worker bound to Queue | Pulls audit jobs, calls Browser Rendering, fans out to 5 agents, aggregates. |
| **Browser Rendering** | Cloudflare Browser Rendering (Playwright-compatible) | Headless Chrome at edge. Returns screenshot (PNG, viewport 1440x900 + full-page) + serialized DOM + computed Lighthouse metrics. |
| **R2** | Cloudflare R2 | `screenshots/{audit_id}.png`, `pdfs/{audit_id}.pdf`, `previews/{audit_id}.html` |
| **Queue** | Cloudflare Queues | `audit-jobs` queue. Lets us absorb burst without blocking request thread; also used for retry. |
| **DB** | Neon Postgres + pgvector | `audits`, `share_codes`, `email_captures`, `waitlist`, `rate_limits`, `agent_runs`. |
| **LLM** | Anthropic Claude API | Sonnet 4 for 4 scoring agents, Haiku for compliance flag (fast/cheap), Opus 4 for preview generation (quality-critical). |
| **Email** | Resend | Transactional emails (PDF delivery, waitlist welcome). |
| **PDF Generation** | `@react-pdf/renderer` in Worker | Server-rendered PDF, written to R2. |

### 2.2 Why Cloudflare Browser Rendering (not Browserless)

- Same-edge co-location with Workers â†’ 200â€“400ms saved vs hitting external Browserless.
- No separate billing or auth surface.
- Native Playwright API via `@cloudflare/puppeteer`.
- Caveat: Browser Rendering has a per-account concurrency cap (currently 10 concurrent browsers on paid plan). Cost governor (Â§7) enforces this.

### 2.3 Request Flow (sequence)

```
Client                  grader-api            Queue          agent-runner       Browser Render   Claude API     Postgres
  â”‚ POST /api/grade        â”‚                    â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚                    â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚                        â”‚ rate-limit check   â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚                        â”‚â”€â”€â”€â–¶ rate_limits â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚
  â”‚                        â”‚ INSERT audits      â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚                        â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚
  â”‚                        â”‚ enqueue job        â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚                        â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚ SSE: {step:"queued"}   â”‚                    â”‚                  â”‚                   â”‚              â”‚             â”‚
  â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚                    â”‚ deliver          â”‚                   â”‚              â”‚             â”‚
  â”‚                        â”‚                    â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚                   â”‚              â”‚             â”‚
  â”‚                        â”‚                    â”‚                  â”‚ render page       â”‚              â”‚             â”‚
  â”‚                        â”‚                    â”‚                  â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚              â”‚             â”‚
  â”‚ SSE: {step:"rendered"} â”‚                    â”‚                  â”‚â—€â”€â”€â”€ screenshot â”€â”€â”€â”‚              â”‚             â”‚
  â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚                    â”‚                  â”‚                                                â”‚
  â”‚                        â”‚                    â”‚                  â”‚ Promise.all(5 agents)            â”‚             â”‚
  â”‚                        â”‚                    â”‚                  â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚              â”‚
  â”‚ SSE: {step:"scoring"}  â”‚                    â”‚                  â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ 5 JSON results â”€â”€â”€â”€â”€â”€â”‚              â”‚
  â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚                    â”‚                  â”‚                                                â”‚
  â”‚                        â”‚                    â”‚                  â”‚ aggregate + UPDATE audits        â”‚             â”‚
  â”‚                        â”‚                    â”‚                  â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚
  â”‚ SSE: {step:"done", payload:{...}}            â”‚                  â”‚                                                â”‚
  â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚                                                â”‚
```

---

## 3. The Scoring Agents

Five agents run in parallel against the same DOM/screenshot bundle. Each returns strict JSON. The aggregator handles missing/malformed output with a defaulted sub-score and a `degraded: true` flag.

### 3.1 Shared Input Bundle (`AgentInput`)

```ts
type AgentInput = {
  audit_id: string;          // UUID
  url: string;
  fetched_at: string;        // ISO timestamp
  html: string;              // serialized DOM, max 200KB after stripping <script>/<style>
  text_content: string;      // visible text only, max 50KB
  screenshot_url: string;    // signed R2 URL, PNG, valid 5 min â€” for vision-capable agents
  viewport: { w: 1440, h: 900 };
  lighthouse: {              // pre-computed
    performance: number;     // 0â€“100
    accessibility: number;
    seo: number;
    fcp_ms: number;
    lcp_ms: number;
    cls: number;
    tti_ms: number;
  };
  forms: Array<{             // pre-extracted via DOM walk
    field_count: number;
    field_types: string[];   // ["email","text","tel",...]
    submit_label: string | null;
    has_phone: boolean;
    has_credit_card: boolean;
  }>;
  meta: {
    title: string | null;
    description: string | null;
    og_image: string | null;
  };
};
```

### 3.2 Agent A â€” Hook Agent (Sonnet 4, vision)

**Purpose:** Score the headline + above-the-fold value prop. Does it pass the 5-second test?

**Model:** `claude-sonnet-4-5` (vision enabled â€” receives screenshot)

**System prompt:**
```
You are a direct-response copywriter who has audited 10,000+ landing pages.
Your job is to score ONLY the hook: the headline, sub-headline, and primary
above-the-fold value proposition. You are scoring whether a cold visitor
understands "what is this and why should I care" within 5 seconds.

Scoring rubric (each 0â€“20, total 0â€“100):
- Clarity: Can a 6th grader paraphrase the value prop?
- Specificity: Concrete outcome/number vs. vague abstractions?
- Relevance: Speaks to a stated audience/pain?
- Differentiation: What makes this not commodity?
- Urgency: Reason to act now vs. bookmark?

Return STRICT JSON. No prose outside the JSON.
```

**User prompt template:**
```
URL: {{url}}
Visible above-the-fold text:
---
{{text_content_first_800_chars}}
---
Meta title: {{meta.title}}
Meta description: {{meta.description}}

[Screenshot attached]

Score this hook. Respond with JSON matching this schema:
{
  "score": <0-100>,
  "subscores": {"clarity":<0-20>,"specificity":<0-20>,"relevance":<0-20>,"differentiation":<0-20>,"urgency":<0-20>},
  "headline_detected": "<verbatim headline you scored>",
  "critique": "<2-3 sentences, blunt, actionable>",
  "rewrite_suggestion": "<one proposed replacement headline>"
}
```

**Expected output:**
```json
{
  "score": 47,
  "subscores": {"clarity":12,"specificity":6,"relevance":11,"differentiation":8,"urgency":10},
  "headline_detected": "Welcome to Acme â€” Smart Solutions for Modern Business",
  "critique": "Headline is generic and could apply to any B2B company. No specific outcome, no named audience. A visitor cannot tell what you sell or for whom.",
  "rewrite_suggestion": "Cut your warehouse pick errors by 40% in 30 days â€” for DTC brands shipping 1,000+ orders/month."
}
```

### 3.3 Agent B â€” Form-Friction Agent (Sonnet 4, no vision)

**Purpose:** Score conversion-form friction. Field count, field types, payment surface, etc.

**Model:** `claude-sonnet-4-5`

**System prompt:**
```
You score conversion-form friction. Lower friction = higher score.
Penalize: >5 fields for a lead form, phone fields when unnecessary,
credit-card collection before value delivery, no privacy-policy link
adjacent to email, weak/unclear submit labels ("Submit", "Send").

If multiple forms exist, score the primary CTA form (largest, most prominent,
or first by DOM order).

Return STRICT JSON.
```

**User prompt template:**
```
Forms detected: {{forms_json}}
Visible form context (surrounding text): {{form_context_text}}

Score with this schema:
{
  "score": <0-100>,
  "primary_form_index": <int or null>,
  "field_count": <int>,
  "friction_factors": ["<list of problems>"],
  "critique": "<2-3 sentences>",
  "fix_suggestion": "<one specific action>"
}
```

### 3.4 Agent C â€” Trust-Signal Agent (Sonnet 4, vision)

**Purpose:** Detect and score testimonials, logos, badges, reviews, guarantees, social proof, named authors.

**Model:** `claude-sonnet-4-5` (vision)

**System prompt:**
```
You audit landing pages for trust signals. Identify and score:
- Customer testimonials (with name/photo/company > anonymous)
- Logo bars / "as seen in" / customer logos
- Star ratings / review counts (with source attribution)
- Guarantees / risk reversals (money-back, free trial, no-CC)
- Named team/founders with credentials
- Security/compliance badges (SOC2, GDPR, HIPAA â€” only score real ones)
- Press mentions

Penalize: fake-looking stock photo testimonials, ungated badges with no
verification link, missing privacy policy, missing terms.

Return STRICT JSON.
```

**Expected output schema:**
```json
{
  "score": 0,
  "signals_found": [
    {"type": "testimonial", "count": 3, "quality": "high|medium|low"},
    {"type": "logo_bar", "count": 1, "logos": ["..."]},
    {"type": "guarantee", "text": "30-day money back"},
    {"type": "press", "outlets": ["TechCrunch"]}
  ],
  "signals_missing": ["..."],
  "critique": "...",
  "top_fix": "..."
}
```

### 3.5 Agent D â€” Mobile / Speed Agent (Haiku, deterministic input)

**Purpose:** Lighthouse already gave us numbers. This agent translates them into a narrative + actionable fix.

**Model:** `claude-haiku-4-5` (cheap, fast, deterministic translation task)

**System prompt:**
```
You translate Lighthouse + mobile-render metrics into a single score (0â€“100)
and one most-impactful fix. Use this weighting:
- LCP: 30%   (<2.5s = full marks)
- FCP: 15%   (<1.8s = full marks)
- CLS: 15%   (<0.1 = full marks)
- TTI: 15%   (<3.8s = full marks)
- Performance score: 15%
- Accessibility score: 10%

Return STRICT JSON.
```

**Expected output:**
```json
{
  "score": 62,
  "core_web_vitals": {"lcp_ms": 3400, "fcp_ms": 2100, "cls": 0.18, "tti_ms": 4200},
  "biggest_drag": "LCP (3.4s) â€” largest contentful paint is a 1.2MB hero image, unoptimized.",
  "fix": "Convert hero.jpg to WebP, add width/height attributes, preload it. Expected LCP reduction: ~1.5s."
}
```

### 3.6 Agent E â€” Compliance Flag Agent (Haiku)

**Purpose:** Surface legal/compliance red flags. GoFunnelAI treats compliance as first-class â€” this agent is the public-facing teaser of that capability.

**Model:** `claude-haiku-4-5`

**System prompt:**
```
You flag legal/compliance issues on landing pages. You are NOT giving legal
advice â€” you are surfacing issues a human lawyer should review. Check:

- Missing privacy policy link (any page collecting email/PII)
- Missing terms of service link
- GDPR: cookie consent banner if site is reachable from EU
- CAN-SPAM: physical address present if collecting email for marketing?
- Health/finance/legal claims without disclaimer ("not medical advice", etc.)
- Income claims / earnings disclaimers (FTC)
- Testimonials without "results not typical" disclaimer for income/health
- Auto-renewing subscriptions disclosed pre-checkout?
- Children-directed content (COPPA red flags)

For each flag, set severity: "info" | "warn" | "high".
Score: 100 - (10 * high + 4 * warn + 1 * info), floored at 0.

Return STRICT JSON.
```

**Expected output:**
```json
{
  "score": 72,
  "flags": [
    {"id": "no_privacy_link", "severity": "high", "summary": "No privacy policy link found on a page that collects email."},
    {"id": "income_claim_no_disclaimer", "severity": "warn", "summary": "\"Make $10k/mo\" claim without earnings disclaimer."},
    {"id": "no_cookie_banner", "severity": "info", "summary": "No cookie consent UI â€” review if EU traffic expected."}
  ],
  "summary": "2 issues worth a lawyer's eye."
}
```

### 3.7 Agent Invocation Pattern (TypeScript, in `agent-runner`)

```ts
// agent-runner/src/agents/index.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function runAgent<T>(
  name: string,
  model: string,
  system: string,
  user: string,
  schema: ZodSchema<T>,
  opts: { vision?: { screenshot_url: string }; max_tokens?: number } = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const content: any[] = [{ type: "text", text: user }];
  if (opts.vision) {
    content.unshift({
      type: "image",
      source: { type: "url", url: opts.vision.screenshot_url }
    });
  }

  const resp = await client.messages.create({
    model,
    max_tokens: opts.max_tokens ?? 1024,
    system,
    messages: [{ role: "user", content }],
    // Prompt caching: cache the system prompt â€” same across every audit.
    // System block is sent with cache_control to cut tokens ~90% after first call.
  });

  const text = resp.content.find((c) => c.type === "text")?.text ?? "";
  try {
    const json = JSON.parse(extractJsonBlock(text));
    return { ok: true, data: schema.parse(json) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function scoreAll(input: AgentInput) {
  const [hook, form, trust, speed, compliance] = await Promise.allSettled([
    runAgent("hook", "claude-sonnet-4-5", HOOK_SYSTEM, hookUser(input), HookSchema, { vision: { screenshot_url: input.screenshot_url } }),
    runAgent("form", "claude-sonnet-4-5", FORM_SYSTEM, formUser(input), FormSchema),
    runAgent("trust", "claude-sonnet-4-5", TRUST_SYSTEM, trustUser(input), TrustSchema, { vision: { screenshot_url: input.screenshot_url } }),
    runAgent("speed", "claude-haiku-4-5", SPEED_SYSTEM, speedUser(input), SpeedSchema),
    runAgent("compliance", "claude-haiku-4-5", COMPLIANCE_SYSTEM, complianceUser(input), ComplianceSchema),
  ]);
  return { hook, form, trust, speed, compliance };
}
```

**Prompt caching:** every system prompt above is sent with `cache_control: { type: "ephemeral" }` on the system block. After the first audit of the day, system tokens cost ~10% of normal. Expected agent cost per audit: **$0.04â€“$0.07 once cache is warm.**

---

## 4. Final Score Aggregation

### 4.1 Algorithm

```ts
function aggregate(results: AgentResults): FinalScore {
  const weights = { hook: 0.30, form: 0.20, trust: 0.20, speed: 0.15, compliance: 0.15 };

  let weighted = 0;
  let weightUsed = 0;
  const subscores: Record<string, number> = {};
  const degraded: string[] = [];

  for (const [key, weight] of Object.entries(weights)) {
    const r = results[key];
    if (r.ok) {
      subscores[key] = r.data.score;
      weighted += r.data.score * weight;
      weightUsed += weight;
    } else {
      subscores[key] = -1; // sentinel
      degraded.push(key);
    }
  }

  // Normalize if any agent failed â€” never penalize the user for our outage.
  const overall = Math.round(weighted / weightUsed);

  const improvements = pickTop3Improvements(results); // see 4.2

  return {
    overall,
    grade: gradeFromScore(overall),       // A+ â‰¥ 95, A 90, B 80, C 70, D 60, F < 60
    subscores,
    critique: composeCritique(results),
    improvements,
    degraded_agents: degraded,
    confidence: degraded.length === 0 ? "high" : "medium",
  };
}
```

### 4.2 Top-3 Improvements Selection

Each agent emits at least one `fix` / `top_fix` / `rewrite_suggestion`. The aggregator:

1. Collects all suggestions with their (estimated impact = `100 - subscore`) and (estimated effort, hardcoded per category).
2. Sorts by `impact / effort`.
3. Returns top 3, each as:

```ts
type Improvement = {
  id: string;                 // "hook.rewrite", "form.cut_fields", ...
  category: "hook" | "form" | "trust" | "speed" | "compliance";
  title: string;              // "Rewrite your headline to name the audience and the outcome"
  detail: string;             // expanded explanation, 1â€“2 sentences
  before?: string;            // optional verbatim sample from page
  after?: string;             // proposed replacement
  estimated_lift: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
};
```

### 4.3 Final API Response Shape (`GET /api/grade/:audit_id`)

```json
{
  "audit_id": "01HW...",
  "url": "https://example.com",
  "fetched_at": "2026-05-25T14:03:22Z",
  "screenshot_url": "https://r2.gofunnelai.com/screenshots/01HW....png",
  "score": {
    "overall": 64,
    "grade": "D",
    "subscores": {
      "hook": 47,
      "form": 72,
      "trust": 55,
      "speed": 62,
      "compliance": 85
    },
    "critique": "Your page has decent compliance hygiene and a clean form, but the hook is generic and trust signals are sparse. A visitor doesn't learn what you sell or who you sell it to in the first 5 seconds.",
    "improvements": [ /* 3 Improvement objects */ ],
    "confidence": "high",
    "degraded_agents": []
  },
  "share_code": "k8x9p2",
  "pdf_url": null,
  "preview_funnel_id": null,
  "agent_runs": {
    "hook":       { "model": "claude-sonnet-4-5", "tokens": 1840, "ms": 2310 },
    "form":       { "model": "claude-sonnet-4-5", "tokens": 920,  "ms": 1100 },
    "trust":      { "model": "claude-sonnet-4-5", "tokens": 2100, "ms": 2510 },
    "speed":      { "model": "claude-haiku-4-5",  "tokens": 410,  "ms": 420  },
    "compliance": { "model": "claude-haiku-4-5",  "tokens": 680,  "ms": 510  }
  }
}
```

---

## 5. "Preview What We'd Generate" Mini-Funnel

### 5.1 Trigger

User clicks "See what we'd generate instead â†’ " on the result page. Fires `POST /api/preview/generate` with `audit_id`.

### 5.2 Target: 30 seconds end-to-end

### 5.3 Pipeline

```
audit_id â”€â–¶ Context extractor (Haiku) â”€â–¶ Brief JSON â”€â–¶ Hero copy agent (Sonnet 4) â”€â”
                  â”‚                                                                  â”‚
                  â””â”€â–¶ Visual brief (Haiku) â”€â–¶ palette + layout token JSON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
                                                                                     â–¼
                                                              Hero renderer (server-side React + Tailwind)
                                                                                     â”‚
                                                                                     â–¼
                                                              HTML stored at R2/previews/{audit_id}.html
                                                                                     â”‚
                                                                                     â–¼
                                                              UI loads in <iframe sandbox>
```

### 5.4 Why Sonnet 4 (not Opus) here

We initially specced Opus for preview generation. After v0 cost modeling at scale, **Sonnet 4 + one-shot examples + prompt caching produces equivalent hero quality at 1/5 cost.** Opus is reserved for the post-signup full-funnel build (multi-page, email sequence, copy variants) in the main product. The Grader preview uses Sonnet 4.

### 5.5 Hero Copy Agent

**Model:** `claude-sonnet-4-5`

**System prompt (cached):**
```
You are GoFunnelAI's hero-section copywriter. Given a brief about a business
and its current landing page's weaknesses, write a replacement hero section.

Output STRICT JSON:
{
  "headline": "<8-14 words, names audience + outcome>",
  "subheadline": "<one sentence, 15-25 words, adds proof or specifics>",
  "primary_cta": "<2-4 words, action-oriented, not 'Submit' or 'Learn More'>",
  "secondary_cta": "<2-4 words or null>",
  "social_proof_line": "<one short line, e.g., 'Trusted by 2,400+ DTC brands' â€” if you cannot infer real numbers, use a generic placeholder marked [PLACEHOLDER]>",
  "trust_badges": ["badge1","badge2","badge3"]  // 3 short labels
}

Rules:
- Specific > vague. Numbers > adjectives.
- Audience must be nameable (DTC brands, SaaS founders, dental practices).
- Outcome must be measurable.
- Never invent customer names or real metrics. Use [PLACEHOLDER] markers.
```

### 5.6 Rendered Output

Single HTML file, mobile-responsive, served from R2 via signed URL, loaded in a sandboxed iframe with a "Built in 28s by GoFunnelAI" watermark and a "Join waitlist for the full funnel" CTA at the bottom.

### 5.7 Cost Cap

Preview generation gated by `cost_governor`: max 500 previews/day company-wide initially. Per IP: 3 previews/24h. Beyond cap â†’ CTA grays out, message: "Preview slots full for today â€” join waitlist to skip the queue."

---

## 6. Email Gate, Shareable URL, Social Meta Tags

### 6.1 Email Gate UX

The result page renders **score + critique + top-3 improvements (visible)**, with the following BEHIND email:
- Full PDF report download
- Detailed sub-score breakdowns with sub-sub-scores
- Compliance flag details (only summary visible)
- Preview generation CTA enabled (locked until email captured)

The gate is a non-blocking modal that slides up after 4 seconds. The user can dismiss to share, but PDF + preview require email.

**Endpoint:** `POST /api/capture`
```ts
// Request
{ audit_id: string, email: string, marketing_consent: boolean }

// Response
{ ok: true, pdf_url: string, preview_unlocked: true }
```

### 6.2 Shareable URL

`gofunnelai.com/grade/s/{share_code}` â€” 6-char base32 code from `share_codes` table.

- Public read, no email required to view.
- Renders the same result page in read-only mode (no re-grade button).
- Strong OG/Twitter card meta with auto-generated share image (see 6.3).

### 6.3 Social Share Image

Generated server-side at audit-completion time using `@vercel/og` (Satori) inside the Worker. Saved to R2.

**Image:** 1200x630, brand background, big score badge ("64 / D"), URL audited, top-line critique line, GoFunnelAI logo.

```ts
// /api/og/audit/[audit_id].png
// Cached at edge for 1 year (immutable; results don't change)
```

### 6.4 Meta Tags on Share Page

```html
<title>Audit: example.com scored 64/100 â€” GoFunnelAI Grader</title>
<meta name="description" content="Free AI funnel audit. We scored example.com 64/100. See the 3 specific improvements." />
<meta property="og:title" content="example.com scored 64/100" />
<meta property="og:description" content="Free AI funnel audit by GoFunnelAI. See the breakdown." />
<meta property="og:image" content="https://r2.gofunnelai.com/og/01HW....png" />
<meta property="og:url" content="https://gofunnelai.com/grade/s/k8x9p2" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@gofunnelai" />
<link rel="canonical" href="https://gofunnelai.com/grade/s/k8x9p2" />
```

---

## 7. Rate Limiting, Abuse Prevention, Cost Governor

### 7.1 Layered Limits

| Layer | Tool | Limit | Action on breach |
|---|---|---|---|
| L1 Edge WAF | Cloudflare WAF managed ruleset + custom rule | Bot Fight Mode ON; block `cf.threat_score > 30` | 403 |
| L2 Per-IP burst | Cloudflare Rate Limiting rule | 10 req / 60s on `/api/grade` | 429 |
| L3 Per-IP daily | App-level (DB `rate_limits` table) | 20 audits / 24h | 429 + "Daily limit hit â€” sign up to remove" |
| L4 Per-target-domain | App-level | 5 audits / domain / 24h (cached result returned for repeats) | 200 with cached payload |
| L5 Global cost governor | Worker reads `cost_governor` row | If today's spend > $400 â†’ enter "degraded mode" (Haiku for all agents); > $600 â†’ queue + delay; > $1000 â†’ hard cutoff with waitlist gate | varies |
| L6 Captcha | Cloudflare Turnstile | Triggered after L2 breach for the IP for 24h | inline challenge |

### 7.2 Abuse Vectors and Mitigations

| Vector | Mitigation |
|---|---|
| Scraper hits us with 10k URLs to drain LLM budget | L3 + L5 + Turnstile after L2 trip |
| Targeting illegal/abusive URLs to embarrass us | URL allowlist filter: block known malware/phishing lists (Cloudflare Radar URL intel); block obvious illegal categories at WAF; manual review queue if `compliance_score < 30` AND flagged terms |
| User submits localhost / RFC1918 / file://  | URL validator rejects non-public schemes/hosts |
| User submits redirect loops or massive pages | Browser Rendering hard timeout 10s; max DOM size 5MB pre-strip |
| User submits PDF / image / non-HTML | Content-Type check; reject with "We grade HTML landing pages." |

### 7.3 URL Validation (strict)

```ts
function validateAuditUrl(raw: string): URL {
  const u = new URL(raw); // throws if malformed
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("scheme");
  if (u.hostname === "localhost") throw new Error("local");
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|0\.|169\.254\.)/.test(u.hostname)) throw new Error("private");
  if (u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) throw new Error("internal");
  if (u.username || u.password) throw new Error("auth");
  return u;
}
```

### 7.4 Cost Governor

```sql
CREATE TABLE cost_governor (
  day DATE PRIMARY KEY,
  spend_cents INT NOT NULL DEFAULT 0,
  audits_completed INT NOT NULL DEFAULT 0,
  previews_generated INT NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'normal' -- 'normal' | 'degraded' | 'queue' | 'cutoff'
);
```

Worker reads this row before each Anthropic call; if `mode != 'normal'`, applies the policy. PagerDuty alerts at $300 daily spend (warning) and $500 (action required).

---

## 8. Database Schema (Neon Postgres)

```sql
-- =====================================
-- audits
-- =====================================
CREATE TABLE audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL,
  url_hostname    TEXT NOT NULL,
  url_hash        TEXT NOT NULL,            -- sha256 of normalized URL; used for cache lookup
  requester_ip    INET,
  requester_ua    TEXT,
  status          TEXT NOT NULL,            -- 'queued'|'rendering'|'scoring'|'done'|'failed'
  failure_reason  TEXT,
  score_overall   INT,                       -- 0â€“100
  score_grade     TEXT,                       -- 'A+'..'F'
  subscores       JSONB,                     -- {hook:47, form:72, ...}
  critique        TEXT,
  improvements    JSONB,                     -- [{Improvement}, ...]
  agent_runs      JSONB,                     -- per-agent meta {model, tokens, ms}
  confidence      TEXT,                       -- 'high'|'medium'|'low'
  degraded_agents TEXT[],
  screenshot_r2_key TEXT,
  pdf_r2_key      TEXT,
  preview_r2_key  TEXT,
  cost_cents      INT,                       -- LLM + render cost in cents
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  -- For semantic dedupe / pattern mining later:
  critique_embedding VECTOR(1536)
);
CREATE INDEX idx_audits_url_hash ON audits(url_hash);
CREATE INDEX idx_audits_hostname ON audits(url_hostname);
CREATE INDEX idx_audits_created ON audits(created_at DESC);
CREATE INDEX idx_audits_requester_ip ON audits(requester_ip, created_at DESC);

-- =====================================
-- share_codes
-- =====================================
CREATE TABLE share_codes (
  code        TEXT PRIMARY KEY,             -- 6-char base32, e.g. 'k8x9p2'
  audit_id    UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count  INT NOT NULL DEFAULT 0,
  last_viewed TIMESTAMPTZ
);
CREATE INDEX idx_share_audit ON share_codes(audit_id);

-- =====================================
-- email_captures
-- =====================================
CREATE TABLE email_captures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               CITEXT NOT NULL,
  audit_id            UUID REFERENCES audits(id),
  source              TEXT NOT NULL,         -- 'grader_pdf_gate'|'grader_waitlist'|'preview_cta'
  marketing_consent   BOOLEAN NOT NULL DEFAULT FALSE,
  ip                  INET,
  ua                  TEXT,
  utm                 JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at         TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX uniq_email_source ON email_captures(email, source);
CREATE INDEX idx_email_audit ON email_captures(audit_id);

-- =====================================
-- waitlist (separate; some emails are waitlist-only without an audit)
-- =====================================
CREATE TABLE waitlist (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               CITEXT UNIQUE NOT NULL,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_audit_id     UUID REFERENCES audits(id),
  position            INT,
  invited_at          TIMESTAMPTZ
);

-- =====================================
-- rate_limits
-- =====================================
CREATE TABLE rate_limits (
  scope       TEXT NOT NULL,        -- 'ip:1.2.3.4' | 'domain:example.com'
  window_day  DATE NOT NULL,
  count       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, window_day)
);

-- =====================================
-- agent_runs (granular per-agent log, for debugging + cost analytics)
-- =====================================
CREATE TABLE agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id    UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  agent_name  TEXT NOT NULL,        -- 'hook'|'form'|'trust'|'speed'|'compliance'
  model       TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  cache_read_tokens INT,
  duration_ms INT,
  ok          BOOLEAN NOT NULL,
  error       TEXT,
  raw_output  TEXT,                  -- store for first 30 days only; auto-purged
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_runs_audit ON agent_runs(audit_id);

-- =====================================
-- cost_governor (singleton-per-day)
-- =====================================
CREATE TABLE cost_governor (
  day             DATE PRIMARY KEY,
  spend_cents     INT NOT NULL DEFAULT 0,
  audits_completed INT NOT NULL DEFAULT 0,
  previews_generated INT NOT NULL DEFAULT 0,
  mode            TEXT NOT NULL DEFAULT 'normal'
);
```

### 8.1 Retention Policy

| Table | Retention |
|---|---|
| `audits` | Forever (anonymized after 90d if no associated email) |
| `agent_runs.raw_output` | 30 days, then NULL out |
| `rate_limits` | 30 days |
| `email_captures` | Forever unless unsubscribe + erasure request |

---

## 9. SEO Strategy

### 9.1 Target Keywords

| Tier | Keyword | Target page |
|---|---|---|
| Primary | "free funnel audit" | `/grade` |
| Primary | "free landing page audit" | `/grade` |
| Primary | "AI funnel grader" | `/grade` |
| Long-tail | "[Competitor] funnel checker" | `/grade/vs/[competitor]` â€” programmatic |
| Long-tail | "[Competitor] alternative funnel audit" | `/grade/vs/[competitor]` |
| Long-tail | "how to grade a landing page" | `/grade/learn/how-we-score` |
| Long-tail | "{industry} landing page examples graded" | `/grade/examples/{industry}` |

### 9.2 Programmatic Pages

- `/grade/vs/clickfunnels`, `/grade/vs/leadpages`, `/grade/vs/unbounce`, `/grade/vs/instapage`, `/grade/vs/funnelytics`, `/grade/vs/landingi` â€” generated at build time, each ~600 words, comparison table, "Grade your [Competitor] page free" CTA.
- `/grade/examples/{industry}` â€” auto-curated showcase of public audits (with consent) for: saas, ecommerce, agency, coach, real-estate, fitness, finance.

### 9.3 Page Metadata

```tsx
// app/grade/page.tsx
export const metadata = {
  title: "Free Funnel Audit â€” Grade Any Landing Page in 15 Seconds | GoFunnelAI",
  description: "Paste a URL. Get a 0â€“100 score, 5 sub-scores, and 3 specific improvements. AI-powered, free, no signup to see your score.",
  alternates: { canonical: "https://gofunnelai.com/grade" },
  openGraph: {
    title: "Free Funnel Audit â€” Grade Any Landing Page in 15 Seconds",
    description: "AI-powered. 15 seconds. Free.",
    url: "https://gofunnelai.com/grade",
    images: ["https://gofunnelai.com/og/grader-default.png"],
    type: "website"
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true }
};
```

### 9.4 Sitemap

`/sitemap.xml` (generated by Next.js `sitemap.ts`):
- `/grade`
- `/grade/vs/*` (all competitor pages)
- `/grade/examples/*`
- `/grade/learn/*`
- `/grade/s/{share_code}` â€” **only included if the audit was marked `is_public: true`** by the user (default false). Share pages otherwise carry `noindex`.

### 9.5 robots.txt

```
User-agent: *
Allow: /grade
Allow: /grade/vs/
Allow: /grade/examples/
Allow: /grade/learn/
Disallow: /grade/s/
Sitemap: https://gofunnelai.com/sitemap.xml
```

(Share pages noindex to avoid duplicate-content cannibalization of `/grade`.)

### 9.6 Structured Data

`/grade` page emits `SoftwareApplication` + `FAQPage` JSON-LD; competitor pages emit `Article` + `FAQPage`.

### 9.7 Internal Linking

Every share-page result includes:
- Footer link "Get your own free audit â†’ /grade"
- Sidebar link "How we score â†’ /grade/learn/how-we-score"
- 3 contextual "Similar audits" links (same industry, public-only)

---

## 10. Telemetry

### 10.1 Event Pipeline

Client â†’ `/api/telemetry` â†’ Cloudflare Analytics Engine â†’ nightly export to BigQuery (later: Tinybird). For real-time ops we also fire to PostHog (self-hosted).

### 10.2 Events

| Event | When | Properties |
|---|---|---|
| `audit_requested` | URL submitted, validated, enqueued | `audit_id`, `url_hostname`, `url_hash`, `requester_ip_hash`, `referrer`, `utm`, `user_agent_class` |
| `audit_render_started` | Browser Rendering call begins | `audit_id` |
| `audit_render_completed` | Render done | `audit_id`, `duration_ms`, `dom_bytes`, `lighthouse_perf` |
| `audit_agent_completed` | Each of 5 agents finishes (fires 5x per audit) | `audit_id`, `agent_name`, `ok`, `duration_ms`, `tokens_in`, `tokens_out`, `cache_read_tokens` |
| `audit_completed` | Aggregation finished, written to DB | `audit_id`, `total_duration_ms`, `score_overall`, `score_grade`, `confidence`, `degraded_count`, `cost_cents` |
| `audit_failed` | Any unrecoverable error | `audit_id`, `stage`, `reason` |
| `share_link_generated` | First view or copy action on share link | `audit_id`, `share_code` |
| `share_link_viewed` | Share page viewed (not by original requester) | `share_code`, `referrer` |
| `email_captured` | Email gate completed | `audit_id`, `source`, `marketing_consent`, `email_domain` (not full email) |
| `pdf_generated` | PDF written to R2 | `audit_id`, `pages`, `bytes` |
| `pdf_downloaded` | PDF actually downloaded | `audit_id` |
| `preview_clicked` | "See what we'd generate" clicked | `audit_id` |
| `preview_completed` | Preview rendered | `audit_id`, `duration_ms`, `cost_cents` |
| `preview_viewed_n_seconds` | Heartbeat at 5s, 15s, 30s, 60s | `audit_id`, `seconds` |
| `waitlist_joined` | Waitlist signup | `audit_id?`, `source`, `position` |
| `rate_limited` | Any L1â€“L5 limit hit | `layer`, `scope`, `endpoint` |
| `cost_governor_mode_changed` | Mode flips | `from`, `to`, `spend_cents` |

### 10.3 PII Rules

- IPs hashed (sha256 + per-day salt) before storage in analytics events; raw IP only in `audits` table and `rate_limits`, retained 30 days then nullified.
- Emails never appear in telemetry â€” only `email_domain` and a sha256.
- `url` is stored as-is in events because the user submitted it intentionally.

### 10.4 Dashboards (Day 14 launch readiness)

1. **Funnel:** `audit_requested â†’ audit_completed â†’ email_captured â†’ preview_clicked â†’ waitlist_joined` with conversion rates.
2. **Latency:** P50/P95/P99 on `total_duration_ms`, broken down by `agent_name`.
3. **Cost:** spend/day, per-audit, per-preview; cumulative-vs-budget burn-down.
4. **Quality:** % `degraded`, % `confidence == low`, agent failure rates.
5. **Abuse:** rate-limit events, top IPs, top target domains.

---

## 11. Two-Engineer / Two-Week Ticket Breakdown

**Team:** Eng A (backend/Workers/agents) + Eng B (frontend/Next.js/SEO).
**Sprint:** Monâ€“Fri Ã— 2 weeks. Day 14 = Friday launch.

### Week 1

#### Day 1 (Mon)
- **A:** Set up `grader-api` Worker scaffold; Wrangler config; bind R2 + Queues + Anthropic API secret. Endpoint stubs (`/api/grade`, `/api/capture`, `/api/preview/generate`, `/api/grade/:share_code`).
- **B:** Bootstrap Next.js 14 app on Cloudflare Pages. Build `/grade` hero page (static). Tailwind tokens.
- **Joint:** Migrations 001 â€” `audits`, `share_codes`, `email_captures`, `waitlist`, `rate_limits`, `agent_runs`, `cost_governor`. Connection pooling via Neon serverless driver.
- **Milestone:** "Hello world" Worker deployed at `gofunnelai.com/api/grade` returns `{ok:true}`.

#### Day 2 (Tue)
- **A:** Browser Rendering integration. POST a URL, return screenshot + DOM snapshot. Lighthouse run. Write screenshot to R2.
- **B:** Build URL input component with client-side validation, animated loading stepper, SSE consumer hook.
- **Milestone:** End-to-end render path: paste URL in browser â†’ see PNG in R2.

#### Day 3 (Wed)
- **A:** Implement Hook agent (Sonnet 4 vision) + Form agent (Sonnet 4). Wire prompt caching. Unit tests with golden fixtures (5 saved pages each).
- **B:** Build result page layout (score circle, sub-score bars, critique block, improvements list). Skeleton state for streaming.
- **Milestone:** Two agents return valid JSON on 5 fixture pages.

#### Day 4 (Thu)
- **A:** Implement Trust agent + Speed agent + Compliance agent. Aggregator function. Aggregator test suite (graceful degradation cases).
- **B:** Email gate modal. POST `/api/capture`. Resend integration for PDF email.
- **Milestone:** Full 5-agent pipeline returns aggregated score on fixtures.

#### Day 5 (Fri)
- **A:** Queue integration (`audit-jobs`). SSE progress stream from Worker â†’ client. Cost governor middleware. Telemetry event emitter to Analytics Engine.
- **B:** Share page (`/grade/s/[code]`). Share code generation. OG image generation route (`@vercel/og`).
- **Milestone:** End-to-end live demo on staging: paste URL â†’ 15s â†’ score â†’ share link â†’ share link renders publicly with OG image.

### Week 2

#### Day 6 (Mon)
- **A:** Rate limiting (L2 Cloudflare rule + L3/L4 DB). Turnstile integration on `/api/grade`. Abuse URL filter.
- **B:** PDF generation (`@react-pdf/renderer`) inside Worker. Write to R2, signed URL via email.
- **Milestone:** PDF arrives in inbox within 30s of email capture. Rate limit returns 429 with friendly UI.

#### Day 7 (Tue)
- **A:** Preview generation pipeline. Context extractor + hero copy agent + visual brief + server-side render to HTML.
- **B:** Preview iframe component, "Built in 28s" watermark, waitlist CTA below preview. Loading state for the 30s wait.
- **Milestone:** End-to-end preview generation works on 3 fixture audits.

#### Day 8 (Wed)
- **A:** Tighten cost governor (modes: normal/degraded/queue/cutoff). Wire PagerDuty alerts. Anthropic prompt caching verification (check `cache_read_tokens` > 0 after 2nd audit).
- **B:** Programmatic competitor pages: `/grade/vs/[competitor]` for top 6 competitors. Sitemap. robots.txt. JSON-LD.
- **Milestone:** 6 competitor pages indexed in Google Search Console (submit sitemap).

#### Day 9 (Thu)
- **A:** Caching layer: dedupe by `url_hash` within 24h. Return cached result with `cached: true` flag.
- **B:** "How we score" learn page (`/grade/learn/how-we-score`). Examples landing pages framework.
- **Milestone:** Re-grading the same URL twice within 24h returns cached result and does not charge LLM.

#### Day 10 (Fri)
- **A:** Telemetry dashboards in PostHog (Funnel, Latency, Cost, Quality, Abuse). Failure-replay tooling: given `audit_id`, rerun pipeline against archived inputs.
- **B:** Email sequences in Resend: (1) audit-completed PDF email, (2) waitlist welcome, (3) Day-2 follow-up "here are 3 specific fixes from your audit," (4) Day-7 "your preview is still here."
- **Milestone:** Day-7 sequence sends correctly on a test account; dashboards live.

#### Day 11 (Mon â€” Week 2 cont. if launching Day 14 = following Fri)
- **Both:** Load test. k6 script: 100 concurrent users, 5 min sustained. Validate P95 < 20s, no agent failures > 2%.
- **A:** Fix any concurrency bugs surfaced; tune Queue consumer count.
- **B:** Polish empty states, error states, mobile layout pass.

#### Day 12 (Tue)
- **A:** Security review pass: URL validator fuzz tests, SSRF tests against rendering pipeline, signed-URL TTLs, CORS lockdown.
- **B:** Accessibility pass: axe-core CI, keyboard nav on result page, screen reader on share page.
- **Milestone:** All P0 bugs fixed.

#### Day 13 (Wed)
- **Joint:** Soft-launch to 50 hand-picked beta users (founder network). Monitor dashboards. Collect 10 audits + 5 share-link views + 5 preview generations.
- **Fix:** Anything that breaks.

#### Day 14 (Thu â€” final day, public Fri AM)
- **Joint:** Final cost-governor sanity check. Confirm budget envelope. Pre-warm prompt caches by running 5 sample audits in production.
- **B:** Ship Product Hunt + Twitter copy. Schedule launch for Friday 8am PT.
- **A:** On-call rotation set up. Runbook published.
- **Launch.**

### Parallel "stretch if time" (cut first if behind)

- `/grade/examples/[industry]` pages (defer to Week 3)
- Multi-language audit support (English-only at launch)
- API access for agency partners (deferred to private beta post-launch)

---

## 12. Acceptance Criteria & Launch Readiness Checklist

### 12.1 Functional Acceptance

- [ ] User can submit any public HTTPS URL and receive a score in â‰¤ 20 seconds (P95).
- [ ] Score includes overall (0â€“100), grade letter, 5 sub-scores, critique paragraph, 3 specific improvements.
- [ ] Each improvement names a category, has before/after where applicable, and labels effort + estimated lift.
- [ ] Email gate appears within 5s of result render and unlocks PDF + preview when submitted.
- [ ] PDF arrives in inbox within 60s of email capture.
- [ ] Shareable URL renders publicly without auth and has OG image.
- [ ] "See what we'd generate" produces a rendered hero in â‰¤ 35s.
- [ ] Re-submitting the same URL within 24h returns cached result without LLM cost.
- [ ] Submitting a localhost/private/non-HTTP URL is rejected with a clear error.

### 12.2 Non-Functional Acceptance

- [ ] P50 total duration â‰¤ 12s; P95 â‰¤ 20s; P99 â‰¤ 30s.
- [ ] Agent failure rate (any single agent) â‰¤ 2% over 100-run sample.
- [ ] Per-audit cost â‰¤ $0.10 once prompt cache is warm.
- [ ] Per-preview cost â‰¤ $0.40.
- [ ] Daily cost stays inside $400 budget at expected Day-1 volume (â‰¤ 4,000 audits).
- [ ] Lighthouse score for `/grade` â‰¥ 95 on mobile.
- [ ] All telemetry events appear in PostHog within 30s of firing.
- [ ] No PII (email, raw IP) in telemetry events.

### 12.3 CI / Test Coverage

- [ ] **Unit:** all 5 agent prompt â†’ JSON parsers pass golden fixtures (5 fixtures per agent).
- [ ] **Unit:** aggregator handles all 32 (2âµ) combinations of agent ok/fail.
- [ ] **Unit:** URL validator passes ~30 hostile inputs (SSRF, schemes, IPs, etc.).
- [ ] **Integration:** end-to-end pipeline against 10 fixture URLs (snapshot test on subscores within Â±5 tolerance).
- [ ] **Integration:** email capture + PDF generation + Resend delivery (against Resend sandbox).
- [ ] **Integration:** rate limiter trips at correct thresholds.
- [ ] **Load:** k6 script â€” 100 concurrent users, 5 min, P95 < 20s, error rate < 1%.
- [ ] **Security:** OWASP ZAP scan against `gofunnelai.com/grade`; no medium-or-higher findings.
- [ ] **Accessibility:** axe-core CI passes on `/grade`, result page, share page.

### 12.4 Operational Readiness

- [ ] Runbook published at `funnel-ai-docs/runbooks/grader.md` covering: scaling Queue consumers, rotating Anthropic API key, flushing rate-limit table, enabling cost-governor cutoff mode.
- [ ] On-call rotation in PagerDuty for launch week.
- [ ] Anthropic API rate-limit headroom verified (we should consume â‰¤ 30% of our org RPM at expected launch traffic).
- [ ] R2 lifecycle rules set: screenshots auto-delete after 90d, PDFs after 180d.
- [ ] Postgres backups verified (Neon point-in-time-restore enabled, 7-day window).
- [ ] Status page at `status.gofunnelai.com` includes Grader as a component.
- [ ] Customer-support inbox (`support@gofunnelai.com`) routed to founder during launch week.

### 12.5 Marketing / Distribution Readiness

- [ ] Product Hunt page drafted with screenshots + demo GIF.
- [ ] Twitter launch thread drafted (5 tweets) with sample audit screenshots.
- [ ] 3 competitor comparison pages live and indexed.
- [ ] Email to existing founder/network warm list scheduled for launch morning.
- [ ] Sample audit shareable URL embedded in launch copy.
- [ ] Hacker News "Show HN" post drafted (do not submit before Product Hunt goes live).

### 12.6 Legal / Compliance

- [ ] Privacy policy updated to mention URL audit data + screenshot retention.
- [ ] Terms of Service include acceptable use: no auditing URLs you don't have rights to (specifically OK because URLs are public, but disclaim no warranty).
- [ ] Cookie banner present for EU traffic (Cloudflare detects via `cf-ipcountry`).
- [ ] Audit data covered in DPA template for future customer agreements.
- [ ] Compliance Flag agent disclaimer ("not legal advice, surface only") rendered on every audit result page.

---

## Appendix A â€” API Endpoint Reference

```
POST   /api/grade                          â†’ { audit_id, share_code, sse_url }
GET    /api/grade/:audit_id                â†’ FinalScore JSON
GET    /api/grade/:audit_id/events         â†’ SSE stream (Server-Sent Events)
GET    /api/grade/s/:share_code            â†’ FinalScore JSON (public)
POST   /api/capture                        â†’ { ok, pdf_url, preview_unlocked }
POST   /api/preview/generate               â†’ { preview_id, eta_seconds }
GET    /api/preview/:preview_id            â†’ { status, html_url, watermark }
POST   /api/waitlist                       â†’ { ok, position }
POST   /api/telemetry                      â†’ { ok }
GET    /api/og/audit/:audit_id.png         â†’ PNG (cached 1y)
GET    /sitemap.xml
GET    /robots.txt
```

## Appendix B â€” Library Pins

| Lib | Version | Purpose |
|---|---|---|
| `next` | 14.2.x | Framework |
| `@anthropic-ai/sdk` | ^0.27.0 | Claude API |
| `@cloudflare/puppeteer` | latest | Browser Rendering client |
| `@cloudflare/workers-types` | latest | TS types |
| `wrangler` | 3.x | Worker CLI |
| `drizzle-orm` | latest | Postgres ORM |
| `@neondatabase/serverless` | latest | Edge-compatible Postgres driver |
| `zod` | 3.x | Schema validation for agent outputs |
| `@vercel/og` | latest | OG image generation |
| `@react-pdf/renderer` | latest | PDF generation |
| `resend` | latest | Transactional email |
| `posthog-js` / `posthog-node` | latest | Telemetry |
| `lighthouse` | latest (via Browser Rendering) | Performance audit |

## Appendix C â€” Environment Variables

```
# Anthropic
ANTHROPIC_API_KEY=

# Cloudflare
CF_ACCOUNT_ID=
CF_API_TOKEN=
BROWSER_RENDERING_BINDING=BROWSER
R2_BUCKET=funnel-grader

# Postgres
DATABASE_URL=postgres://...neon.tech/funnel?sslmode=require

# Email
RESEND_API_KEY=

# Telemetry
POSTHOG_API_KEY=
POSTHOG_HOST=https://posthog.gofunnelai.com

# Security
TURNSTILE_SECRET=
TURNSTILE_SITEKEY=
RATE_LIMIT_DAILY_SALT=

# Cost guardrails
DAILY_BUDGET_USD=400
DAILY_HARD_CAP_USD=1000
```

## Appendix D â€” Open Questions Resolved During Spec

| Question | Resolution |
|---|---|
| Opus or Sonnet for preview? | Sonnet 4 (Opus reserved for full-product funnel generation post-signup). |
| Show score before or after email gate? | Before. Score + 3 improvements visible; PDF + preview gated. Maximizes virality. |
| Allow non-public URLs (auth-required pages)? | No. Only public HTTPS at launch. |
| Should share pages be indexable? | No (noindex). Avoids duplicate-content cannibalization of `/grade`. |
| Render in mobile or desktop viewport? | Desktop 1440x900 for screenshot; Lighthouse runs mobile profile. Both signals fed to agents. |
| Cache strategy? | URL-hash dedupe within 24h returns cached payload (no LLM cost, same result). |
| Localized content? | English-only at launch. i18n in Day-30 roadmap. |

---

**End of build spec. Engineering is unblocked to start Day 1.**
