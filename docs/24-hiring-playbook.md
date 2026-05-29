# 24 — GoFunnelAI Hiring Playbook

**Version:** 1.0
**Owner:** Founder / CEO (will transition to COO + VP Eng by month 13)
**Scope:** First 25 hires, months 1–18 post-launch.
**Operating posture:** Remote-first, async-default, with two anchor timezones (US Pacific and Central European). Every role has a defined timezone-overlap requirement with the founder.
**Companion docs:** 08-engineering-ops-spec.md, 13-agency-enablement-kit.md, 06a-customer-success-activation-framework.md.

---

## How to read this doc

- **PART A** is the ordered hire list with full role packets. Roles are numbered 1–25 in the sequence the founder should run them.
- **PART B** is the rubric library — each role family has its own rubric and loop structure.
- **PART C** is sourcing: where to find the people for each family.
- **PART D** is compensation philosophy and the band tables.
- **PART E** is the 30/60/90 onboarding skeleton applied per role.
- **PART F** is founder time allocation (the constraint behind the sequence).
- **PART G** is the equity model for founders + first 25.
- **PART H** is D&I targets and audit cadence.

The founder should be able to open this doc, pick the next role, and start interviewing the same week.

---

# PART A — The 25 Roles

> Conventions: "IC" = individual contributor, levels 1–6. "M" = manager, levels 1–3. Comp bands are USD, SF/NY Ã— 1.0 baseline. Equity ranges are % of fully diluted post-Series A cap. Sign-on bonuses are post-tax retention tools; only listed where used.

---

## Months 1–3 — Founding team (roles 1–4)

### Role 1 — AI Engineer / Founding Engineer #1

- **Level:** IC5 (Founding)
- **Reports to:** Founder
- **Mandate:** Owns the orchestration engine — agent prompts, tool routing, eval harness, the planner/generator/critic loop, and the cost governor's runtime hooks (see 07c-cost-governor.md).
- **Primary responsibilities:**
  - Design and ship the agent orchestrator (LangGraph-style planner, generator, critic, judge).
  - Own prompt library, prompt versioning, and per-vertical KB-pack adapters (see 02a/02b).
  - Build the eval harness — golden sets per vertical, regression bench, A/B prompt routing.
  - Own model selection logic (Claude/GPT/open-weight fallback, cost ceilings per request).
  - Pair with Engineer #3 on the integration adapter SDK so generated artifacts publish cleanly.
  - First-on-call for generation-quality incidents until the Trust & Safety Lead is hired.
- **Must-have qualifications:**
  - 5+ years engineering, with 1+ year shipping LLM-backed product in production at scale.
  - Has written eval harnesses from scratch (golden sets, automated grading, regression alerts).
  - Comfortable in Python (or TypeScript with Python adjacency) and prompt-engineering at depth.
  - Has shipped an agentic system that calls tools — not just chat wrappers.
  - Can read a model paper and translate it into a product decision the same day.
- **Nice-to-haves:** Open-source contributions to LangChain/LlamaIndex/DSPy/vLLM; published evals; worked on RLHF/fine-tuning; ex-Anthropic / OpenAI / Cohere applied research adjacent.
- **Ideal-source companies:** Anthropic (applied), OpenAI (applied), Adept, Cohere, Inflection, Imbue, Perplexity, Vercel AI SDK team, Replicate, Modal, Pinecone, LangChain, Harvey, Sierra, Cresta, Together.ai, Mistral applied.
- **First-90-days impact:** Orchestrator v1 in production by day 60; eval harness live with three verticals (solar, med-spa, agency) by day 75; cost-per-funnel metric tracked and trending down 20% by day 90.
- **Interview rubric (engineering family — see PART B for full scale):**
  1. Technical depth — must be 5
  2. AI/LLM understanding — must be 5
  3. System thinking — must be 4+
  4. Ownership — must be 5
  5. Communication — must be 4+
  - **Hire threshold:** 5 on technical depth AND AI/LLM understanding; â‰¥4 on the other three.
- **Loop:** Founder screen â†’ take-home (build a small agent + eval harness, 4h cap) â†’ tech deep-dive with founder â†’ system design with an outside advisor (we'll line up one ex-Anthropic / ex-Stripe staff eng) â†’ reference calls (3, on-list). Decision: founder lead, advisor veto.
- **Comp band:**
  - Base: $185k–$215k (below market for level, deliberate)
  - Equity: 1.5%–3.0% (4yr vest, 1yr cliff, double-trigger accel)
  - Sign-on: $25k retention bonus, 12-month clawback
- **Location:** Remote. Must overlap 4 hours/day with US Pacific.

---

### Role 2 — Full-Stack Founding Engineer #2

- **Level:** IC5 (Founding)
- **Reports to:** Founder
- **Mandate:** Owns the customer-visible product surface — Next.js app, the funnel editor, the dashboard, the auth + billing stack, the Postgres schema, and the Cloudflare edge deployment.
- **Primary responsibilities:**
  - Ship the Next.js 14+ app (App Router, Server Actions, RSC where it earns its keep).
  - Own Postgres schema, migrations, RLS policies; row-level multi-tenancy.
  - Stand up auth (Clerk or roll-our-own), billing (Stripe + metered usage), entitlements.
  - Own the Cloudflare Workers / Pages / R2 / D1 deployment topology and CI/CD.
  - Pair with the Founding Designer to translate the component library into a working design system in code.
  - Co-own performance budget: TTFB <200ms p75 globally, LCP <2.5s.
- **Must-have qualifications:**
  - 5+ years full-stack, last 2+ years shipping Next.js (App Router) at production scale.
  - Strong Postgres — schema design, query tuning, has lived through a real migration incident.
  - Has shipped on Cloudflare Workers / Vercel Edge / similar; understands the edge runtime tradeoffs.
  - Stripe billing experience including metered, proration, and dunning.
- **Nice-to-haves:** Has built a multi-tenant SaaS from zero; Drizzle/Prisma/Kysely; tRPC; design-system fluency (Radix, shadcn); has done a Series A â†’ B scaling.
- **Ideal-source companies:** Vercel, Linear, Notion, Cal.com, Liveblocks, Resend, Clerk, Stripe (engineering), Supabase, PlanetScale, Railway, Render, Cloudflare (engineering), Retool, Airtable.
- **First-90-days impact:** Auth + billing + multi-tenant scaffolding in production by day 30; funnel editor MVP by day 60; full design-system-in-code parity with the designer's Figma by day 90.
- **Interview rubric (engineering):**
  1. Technical depth — 5
  2. System thinking — 5
  3. AI/LLM understanding — 3+ (does not need to be deep here)
  4. Ownership — 5
  5. Communication — 4+
  - **Hire threshold:** â‰¥4 on all five; 5 on technical depth and system thinking.
- **Loop:** Founder screen â†’ take-home (build a small multi-tenant Next.js feature with Stripe metered billing, 6h cap) â†’ tech deep-dive â†’ pair-coding round with Engineer #1 â†’ references (3). Decision: founder lead, Engineer #1 veto once hired.
- **Comp band:**
  - Base: $180k–$210k
  - Equity: 1.5%–2.5%
  - Sign-on: $25k
- **Location:** Remote. 4h overlap with US Pacific.

---

### Role 3 — Founding Designer

- **Level:** IC5 (Founding)
- **Reports to:** Founder
- **Mandate:** Owns product, brand, and the funnel component library that customers' agents will assemble from. Sets the visual ceiling of the company.
- **Primary responsibilities:**
  - Brand system: wordmark, type stack, color, motion language. Ship v1 by day 45.
  - Product design: funnel editor, dashboard, onboarding (see 10-website-and-onboarding-copy.md).
  - Funnel component library — the actual blocks the AI assembles into pages, per vertical. 80 components by day 90.
  - Marketing site and content design partnership with the Head of Content (when hired).
  - Design ops: Figma library, tokens, handoff to Engineer #2.
- **Must-have qualifications:**
  - 6+ years product design, with at least one zero-to-one as a founding/early designer.
  - Has built and shipped a design system that engineers actually use.
  - Strong brand range — has done both startup-cute and enterprise-trustworthy.
  - Reads and writes some HTML/CSS; can ship Figma-to-code without translation tax.
- **Nice-to-haves:** Motion (After Effects / Rive); illustration; has designed funnels/landing pages commercially; ex-Linear / Notion / Vercel / Stripe.
- **Ideal-source companies:** Linear, Notion, Vercel, Stripe, Figma, Loom, Arc/The Browser Company, Framer, Webflow, Ramp, Mercury, Pitch, Raycast, Superhuman.
- **First-90-days impact:** Brand v1 shipped by day 45; product design system live in Figma + code by day 75; 80 funnel components in library + design QA pass on the launched product by day 90.
- **Interview rubric (design):**
  1. Visual craft — 5
  2. Product thinking — 4+
  3. Brand range — 4+
  4. Technical implementation knowledge — 4+
  5. Taste — 5
  - **Hire threshold:** â‰¥4 on all five; 5 on craft and taste.
- **Loop:** Founder screen â†’ portfolio deep-dive (live walk-through, not slides) â†’ design exercise (redesign one screen of a competitor + brand sketch, 4h cap) â†’ working session (co-design a funnel block with founder, 90 min) â†’ references (3). Decision: founder lead.
- **Comp band:**
  - Base: $170k–$200k
  - Equity: 1.5%–2.5%
  - Sign-on: $20k
- **Location:** Remote. 4h overlap with US Pacific or CET (designer's choice — async-friendly role).

---

### Role 4 — Founding Engineer #3 (Platform / Integrations)

- **Level:** IC5 (Founding)
- **Reports to:** Founder
- **Mandate:** Owns the integration matrix and adapter SDK — every place a GoFunnelAI-generated artifact has to land (CRMs, ad platforms, hosting targets, webhooks). See 04-integration-matrix-and-pal.md.
- **Primary responsibilities:**
  - Design the adapter SDK so a single integration ships in <3 days of engineer-time.
  - Ship priority adapters: GHL, HubSpot, Salesforce, Stripe, Meta Ads, Google Ads, TikTok Ads, Klaviyo, SendGrid, Twilio, Webflow, WordPress, Shopify.
  - Own webhook reliability — idempotency, replay, DLQ, observability.
  - Build the Publish-Acknowledgment flow (see 05e) — the technical layer behind the legal one.
  - Own the partner-tier process (rate limits, OAuth refresh, integration health checks).
- **Must-have qualifications:**
  - 5+ years backend, has owned platform/integration work as a primary discipline.
  - Has built an SDK or adapter framework someone else successfully used.
  - Deep with OAuth2, webhooks, retries, rate limits, idempotency keys.
  - Has shipped against at least three of: GHL, HubSpot, Salesforce, Stripe, Meta/Google Ads APIs.
- **Nice-to-haves:** Has worked at Zapier / Make / Workato / Pipedream; has built a partner program technically; understands ad platform attribution.
- **Ideal-source companies:** Zapier, Make, Workato, Pipedream, Segment, RudderStack, Stripe (Connect team), Plaid, MessageBird, Twilio, Klaviyo, GoHighLevel (platform team), HubSpot (platform), Salesforce (AppExchange platform).
- **First-90-days impact:** Adapter SDK shipped + 5 priority adapters live by day 60; 10 adapters by day 90; webhook DLQ + replay UI shipped.
- **Interview rubric (engineering):**
  1. Technical depth — 5
  2. System thinking — 5
  3. AI/LLM understanding — 3+
  4. Ownership — 5
  5. Communication — 4+
  - **Hire threshold:** â‰¥4 on all; 5 on technical depth, system thinking, ownership.
- **Loop:** Founder screen â†’ take-home (build a webhook receiver + adapter for a public API of their choice, 6h cap) â†’ deep-dive on the take-home â†’ system design (integration matrix tradeoffs) â†’ references. Decision: founder lead, Eng #1 + #2 advise.
- **Comp band:**
  - Base: $180k–$210k
  - Equity: 1.25%–2.25%
  - Sign-on: $20k
- **Location:** Remote. 4h overlap with US Pacific or CET.

---

## Months 4–6 — Expansion (roles 5–9)

### Role 5 — Head of Growth

- **Level:** M1 / IC6 hybrid (player-coach)
- **Reports to:** Founder
- **Mandate:** Owns the viral loops (see 16-viral-loops-spec.md), affiliate program, paid funnel, and conversion optimization across the entire acquisition surface.
- **Primary responsibilities:**
  - Own the K-factor: invite mechanics, "Powered by GoFunnelAI" loop, affiliate program (initially solo; hires a growth marketer by month 9).
  - Build the experimentation system: hypothesis log, weekly experiment review, statistical literacy embedded.
  - Run paid acquisition (Meta + Google + TikTok + YouTube pre-roll) once the founder content engine is producing reels.
  - Own activation funnel partnership with Customer Success Lead.
  - North-star metrics: CAC, payback period, K-factor, week-4 retention.
- **Must-have qualifications:**
  - 7+ years growth, with 3+ years owning a viral or PLG loop end-to-end.
  - Has run a paid program at $250k+/mo spend with positive payback.
  - Strong SQL + spreadsheet math; can model a funnel without a data analyst.
  - Has shipped copy that converted — not just briefed it.
- **Nice-to-haves:** Has launched an affiliate program at scale; community-led growth experience; ex-creator economy company.
- **Ideal-source companies:** Notion (growth), Loom, Vercel (growth), Linear, Cal.com, Webflow, Framer, Beehiiv, Substack, Skool (growth), GoHighLevel (growth), Hormozi/Acquisition.com portfolio, ClickFunnels.
- **First-90-days impact:** K-factor measured + first viral-loop experiment live by day 30; affiliate program v1 by day 60; activation funnel A/B framework live with first 3 wins shipped by day 90.
- **Interview rubric (growth):**
  1. Experimentation mindset — 5
  2. Channel literacy — 4+
  3. Math fluency — 4+
  4. Copywriting — 4+
  5. Founder-mentality — 5
  - **Hire threshold:** â‰¥4 on all five.
- **Loop:** Founder screen â†’ portfolio + numbers walk-through (show me your experiment log) â†’ growth exercise (audit GoFunnelAI funnel, propose 5 experiments with sized impact) â†’ pair-think session with founder â†’ references. Decision: founder lead.
- **Comp band:**
  - Base: $190k–$220k
  - Equity: 0.5%–0.8%
  - Sign-on: $20k
- **Location:** Remote. 4h overlap US Pacific.

---

### Role 6 — Head of Content

- **Level:** IC6 (player-coach)
- **Reports to:** Founder
- **Mandate:** Runs the founder content engine — YouTube long-form, shorts, podcast, X/LinkedIn, the book, the newsletter. Treats the founder's calendar as the production constraint. See 09-founder-content-pack.md.
- **Primary responsibilities:**
  - Own the founder's content calendar: 1 long-form/week, 5 shorts/week, 1 podcast/week, 1 newsletter/week, 1 long X thread/week.
  - Run the production pipeline: shoot days, editing handoff (initially contractors), distribution.
  - Ghostwrite the founder's book (target: month 12 launch, 40k words).
  - Build the recruiting-via-content loop — every video has a "we're hiring" CTA.
  - Manage the editing roster + thumbnail designer + clipper team.
- **Must-have qualifications:**
  - 5+ years content, with founder-ghostwriting or executive content experience.
  - Has run a creator's content engine at 100k+ subs scale or equivalent.
  - Range: can write a thread, write a YouTube script, edit a podcast outline, brief a thumbnail.
  - Has published their own thing — newsletter, podcast, channel — and can show the numbers.
- **Nice-to-haves:** Has worked with Hormozi-tier creator (or alum); has run a Beehiiv newsletter at scale; has published a book.
- **Ideal-source companies:** Acquisition.com (content team), Hormozi alumni, MrBeast adjacent ops, Beehiiv (content), Morning Brew, The Hustle, Workweek, Every, Lenny's Newsletter team, Colin & Samir adjacent, Modern Wisdom team, Cleo Abram team.
- **First-90-days impact:** Content engine producing on cadence by day 30; founder shoot days locked + first 4 long-forms shipped by day 60; book outline + first 3 chapters drafted + recruiting-via-content loop tracking applications by day 90.
- **Interview rubric (content):**
  1. Voice match — 5
  2. Distribution understanding — 4+
  3. Production speed — 4+
  4. Founder-ghostwriting ability — 5
  5. Range — 4+
  - **Hire threshold:** 5 on voice match AND ghostwriting; â‰¥4 on the other three.
- **Loop:** Founder screen â†’ voice test (write a 600-word LinkedIn post in the founder's voice on a topic the founder picks, 24h turnaround) â†’ portfolio walk-through â†’ working session (co-script a 12-min YouTube video, 90 min) â†’ references. Decision: founder lead.
- **Comp band:**
  - Base: $160k–$190k
  - Equity: 0.4%–0.7%
  - Sign-on: $15k
- **Location:** Remote. Must be willing to travel to founder's location 1 week/quarter for shoots.

---

### Role 7 — Community Manager

- **Level:** IC4
- **Reports to:** Head of Growth (dotted line to Head of Content)
- **Mandate:** Migrates and runs the Skool community, stands up 30 industry hubs, designs the gamification + leaderboard system. Owns the community-to-customer pipeline.
- **Primary responsibilities:**
  - Migrate the founder's existing audience to a Skool (or self-hosted) community by day 45.
  - Stand up 30 industry hubs (one per vertical the product launches in) with hub-leader recruiting.
  - Design gamification: levels, badges, leaderboards, weekly challenges.
  - Run office hours, weekly AMAs, and the case-study pipeline.
  - Partner with Customer Success on activation moments tied to community participation.
- **Must-have qualifications:**
  - 4+ years community work, with at least one community â‰¥10k members run end-to-end.
  - Has migrated or stood up a community on Skool / Circle / Discord / Slack at scale.
  - Has designed gamification systems that drove measurable engagement.
- **Nice-to-haves:** Creator community experience; ex-Skool / Circle / Geneva; has built hub-leader programs.
- **Ideal-source companies:** Skool (CS / community ops), Circle.so, Geneva, Discord (community team), Notion ambassadors team, Webflow community, Figma community, GHL community, Hormozi community ops.
- **First-90-days impact:** Audience migrated + 5 of 30 industry hubs live by day 30; gamification system live by day 60; weekly content cadence (office hours + AMA + challenge) + 3 case studies sourced from community by day 90.
- **Interview rubric (ops, modified):**
  1. Scaling experience — 4+
  2. Systems thinking — 4+
  3. Conflict resolution — 5 (this role lives in conflict)
  4. Talent magnetism (recruiting hub leaders) — 4+
  5. Calm-under-fire — 5
  - **Hire threshold:** â‰¥4 on all; 5 on conflict resolution and calm.
- **Loop:** Founder screen â†’ community audit exercise (audit GoFunnelAI's existing audience + propose 90-day plan) â†’ role-play (handle a difficult member, handle a hub leader who's gone off-message) â†’ references (must include 2 community members from prior role, not just managers). Decision: Head of Growth lead, founder confirm.
- **Comp band:**
  - Base: $110k–$135k
  - Equity: 0.15%–0.3%
- **Location:** Remote. Any timezone — community runs 24/7.

---

### Role 8 — Compliance / Legal Counsel (FTE)

- **Level:** IC6
- **Reports to:** Founder (will report to COO when hired)
- **Mandate:** Internalize the legal retainer relationship. Owns FTC compliance, AI regulation tracking, the publish-ack flow (see 05e), the AUP (see 05c), and international privacy posture as the product expands.
- **Primary responsibilities:**
  - Own the Acceptable Use Policy and the Trust & Safety policy interface (with T&S Lead, role 14).
  - Run the publish-acknowledgment legal layer; review the human review queue's escalation tier (see 07b).
  - Track AI regulation across US (state + federal), EU (AI Act), UK, Canada, Australia, Brazil, India.
  - Negotiate and own enterprise/agency contracts ($997/mo+ tier).
  - Manage outside counsel relationships (litigation, IP, employment).
  - Quarterly compliance review with the founder; risk register.
- **Must-have qualifications:**
  - JD + active bar admission (US, any state).
  - 6+ years practicing, with 2+ years at a tech/SaaS company in-house OR at a tech-focused firm.
  - Has lived through an FTC inquiry, a state AG inquiry, or a CCPA/GDPR audit.
  - Deep familiarity with FTC Act Â§5, CAN-SPAM, TCPA, COPPA, state UDAP statutes.
  - Reads AI policy news as a hobby.
- **Nice-to-haves:** Has shipped a generative-AI product's policy stack; published on AI regulation; has worked at Anthropic / OpenAI / Stability / similar.
- **Ideal-source companies:** Anthropic (legal), OpenAI (legal), Stripe (legal), Notion (legal), Figma (legal), Stability/Runway/Midjourney legal, FTC alumni (consumer protection division), Fenwick / Cooley / Wilson Sonsini AI practice associates.
- **First-90-days impact:** Outside-counsel retainer audited + scoped down by day 30; AUP + T&S policy v2 shipped by day 60; AI regulation tracker live + first quarterly risk register delivered by day 90.
- **Interview rubric (legal):**
  1. AI regulation depth — 5
  2. FTC familiarity — 5
  3. International privacy — 4+
  4. Business-friendly judgment — 5 (we need a "how do we ship this safely" lawyer, not a "no" lawyer)
  5. Communication — 4+
  - **Hire threshold:** â‰¥4 on all; 5 on AI regulation, FTC, and business-friendly judgment.
- **Loop:** Founder screen â†’ written exercise (draft a memo: "Here's our publish-ack flow. What's the top legal risk and how would you mitigate?") â†’ deep-dive on memo + scenario role-plays (FTC inquiry, agency customer demand, state AG letter) â†’ meeting with current outside counsel as a reference-check / fit check â†’ references (3, including one former in-house client). Decision: founder lead.
- **Comp band:**
  - Base: $230k–$270k
  - Equity: 0.3%–0.6%
  - Sign-on: $30k
- **Location:** Remote, US. Bar admission state determines which states get pro-hac issues; prefer NY or CA bar.

---

### Role 9 — Customer Success Lead

- **Level:** IC5
- **Reports to:** Founder (will report to COO)
- **Mandate:** Owns the activation framework (see 06a), the concierge onboarding tier for paid customers, retention metrics, and the playbooks that the Senior CSM (role 23) will later run for agency-tier accounts.
- **Primary responsibilities:**
  - Own the activation funnel — time-to-first-funnel, time-to-first-published, time-to-first-conversion.
  - Run the concierge onboarding for the top 20% of paid customers (high-touch white-glove).
  - Build the playbook library: low-touch onboarding email sequences, in-app activation moments, churn-save plays.
  - Own the customer health score; weekly churn-risk review with the founder.
  - First responder for crisis comms tickets (with Legal + Founder; see 06b).
- **Must-have qualifications:**
  - 5+ years CS, with 2+ years at a PLG SaaS company at $1M–$50M ARR stage.
  - Has owned an activation funnel and improved it with measurable wins.
  - Has run both low-touch (automated) and high-touch (concierge) CS in the same role.
  - Comfortable with SQL, Hex / Mode / Metabase, and Customer.io / Intercom / Vitally.
- **Nice-to-haves:** Has launched a community-driven CS motion; ex-Notion / Figma / Linear / Webflow CS.
- **Ideal-source companies:** Notion, Linear, Figma, Webflow, Loom, Vercel, Cal.com, Mercury, Ramp, Beehiiv, ConvertKit, Skool.
- **First-90-days impact:** Activation framework instrumented + reported by day 30; concierge tier launched with 20 customers by day 60; first churn-save play documented + 3 expansion wins from concierge tier by day 90.
- **Interview rubric (ops, modified for CS):**
  1. Scaling experience — 4+
  2. Systems thinking — 4+
  3. Conflict resolution — 5
  4. Talent magnetism — 4+
  5. Calm-under-fire — 5
  - **Hire threshold:** â‰¥4 on all.
- **Loop:** Founder screen â†’ playbook teardown (review the activation framework, propose 3 improvements) â†’ role-play (handle a churning $997/mo customer; handle a customer in a crisis-comms moment) â†’ working session with founder on metrics â†’ references. Decision: founder lead.
- **Comp band:**
  - Base: $145k–$170k
  - Equity: 0.3%–0.5%
- **Location:** Remote. 4h overlap with US Pacific or CET.

---

## Months 7–9 — Mobile + scale (roles 10–15)

### Role 10 — Mobile Engineer (iOS)

- **Level:** IC4
- **Reports to:** Founder (will report to VP Eng)
- **Mandate:** Owns iOS app — React Native shell with native modules where performance demands it. Pairs with role 11 (Android) on shared RN codebase.
- **Primary responsibilities:**
  - Ship iOS app v1 (auth, funnel viewer, lead inbox, push notifications).
  - Native modules where RN bridge isn't enough (camera capture, push, deep linking, share extension).
  - App Store submissions, TestFlight discipline, crash analytics (Sentry/Bugsnag).
  - Pair with web engineers on shared API design.
- **Must-have:** 4+ years mobile; 2+ years React Native; 2+ years native Swift/Obj-C; shipped to App Store.
- **Nice-to-haves:** Expo experience; has shipped a creator-facing mobile app; native modules portfolio.
- **Ideal-source companies:** Linear (mobile), Notion (mobile), Cal.com, Loom, Mercury (mobile), Ramp (mobile), Cash App, Robinhood, Coinbase, Discord, Cameo, Beehiiv (mobile if applicable), Coursera mobile.
- **First-90-days impact:** iOS scaffolding + auth + funnel viewer in TestFlight by day 30; push + deep linking + share extension by day 60; v1 in App Store by day 90.
- **Interview rubric (engineering):** Tech depth 5, System thinking 4+, AI/LLM 3+, Ownership 5, Communication 4+.
- **Loop:** Founder/VP-Eng screen (founder until VP Eng hired) â†’ take-home (build a 2-screen RN feature with one native module, 6h cap) â†’ tech deep-dive â†’ pair with Engineer #2 on web/mobile API design â†’ references.
- **Comp band:** Base $170k–$195k, equity 0.15%–0.30%.
- **Location:** Remote. 4h overlap US Pacific.

---

### Role 11 — Mobile Engineer (Android)

Same shape as Role 10 with Android specialization. Kotlin / Jetpack Compose. Same band, same loop, same rubric. Pairs with Role 10 on RN core.

- **Ideal-source companies:** Linear, Notion, Cash App, Robinhood, Discord, Pinterest, Square (Android), Block portfolio, Spotify Android, Beehiiv (if applicable).
- **First-90-days impact:** Android parity with iOS by day 90; Play Store submission by day 90.

---

### Role 12 — DevOps / SRE Engineer

- **Level:** IC5
- **Reports to:** Founder (will report to VP Eng)
- **Mandate:** Owns infrastructure operations — Cloudflare topology, Postgres operations, Redis, observability, on-call rotation, cost monitoring.
- **Primary responsibilities:**
  - Build the observability stack: logs (Cloudflare Logpush â†’ Iceberg), metrics (OTel â†’ Grafana / Honeycomb), traces, SLOs.
  - Own on-call rotation and incident management (PagerDuty/Incident.io).
  - Postgres ops: backups, point-in-time recovery, replication, query budget enforcement.
  - Redis ops: capacity, eviction policy, failover.
  - Cost monitoring: per-tenant infra cost, model spend, edge bandwidth.
  - Security baseline: secret management, IAM, dependency scanning, SOC2 prep.
- **Must-have:** 5+ years SRE/DevOps; has owned production Postgres in incident; has built observability from scratch.
- **Ideal-source companies:** Cloudflare (SRE), Vercel, Linear, Notion, Stripe (infra), Mercury, Ramp, Supabase, PlanetScale, Fly.io, Railway, Render.
- **First-90-days impact:** Observability stack live + SLO dashboard by day 30; on-call rotation formalized + first GameDay run by day 60; cost monitoring + budget alarms by day 90.
- **Interview rubric (engineering):** Tech depth 5, System thinking 5, AI/LLM 3+, Ownership 5, Comms 4+.
- **Loop:** Founder screen â†’ take-home (design an observability stack on Cloudflare for a multi-tenant app, written, 4h) â†’ tech deep-dive â†’ incident simulation (we throw a fake incident, watch them work) â†’ references.
- **Comp band:** Base $190k–$220k, equity 0.25%–0.45%, sign-on $15k.
- **Location:** Remote. Must overlap 4h US Pacific. Carries on-call.

---

### Role 13 — Head of Education / Academy

- **Level:** IC6 / M1
- **Reports to:** Founder (will report to COO)
- **Mandate:** Owns the academy curriculum, online courses, the college pilot program, and the certification path that becomes a recruiting and retention engine.
- **Primary responsibilities:**
  - Build GoFunnelAI Academy: video course (3 tracks — solo founder, agency, in-house marketer).
  - Run the college pilot — 10 universities by month 12, including HBCU partnerships (D&I + commercial overlap; see PART H).
  - Certification program (GoFunnelAI Certified Builder, Certified Agency Partner).
  - Partner with Head of Content on educational content; partner with Community Manager on hub-leader training.
- **Must-have:** 5+ years EdTech or corporate L&D or creator education; has built and shipped a paid course at $250k+ rev.
- **Ideal-source companies:** Coursera, Maven, Section, Reforge, Lambda School / Bloom Institute alumni, Codecademy, Y Combinator Academy team, On Deck (education), Skool (education side), HBCU career-services alumni.
- **First-90-days impact:** Curriculum framework + first track scripted by day 30; first 2 courses shipped by day 60; college pilot — 3 pilot universities signed by day 90.
- **Interview rubric (ops + content blend):** Voice match 4+, Distribution understanding 4+, Production speed 4+, Founder-ghostwriting 3+, Range 5. (Use content rubric.)
- **Loop:** Founder screen â†’ portfolio (show me a course you built + the numbers) â†’ curriculum exercise (design a 3-track curriculum for GoFunnelAI, 1 week) â†’ working session â†’ references.
- **Comp band:** Base $160k–$185k, equity 0.3%–0.5%.
- **Location:** Remote.

---

### Role 14 — Trust & Safety Lead

- **Level:** IC5
- **Reports to:** Legal Counsel (with dotted line to founder)
- **Mandate:** Staffs and runs the human review queue (see 07b), owns the T&S policy operationally, manages escalations, and builds the reviewer team (initially contractors).
- **Primary responsibilities:**
  - Own the human review queue — SLAs, reviewer training, quality calibration.
  - Build and manage the contractor reviewer team (target 8 contractors by month 12).
  - Run policy enforcement: account warnings, suspensions, terminations; appeals process.
  - Partner with Engineering on classifier improvements and false-positive/negative reporting.
  - Crisis response: works with Legal + Founder on edge cases.
- **Must-have:** 4+ years T&S at a consumer or creator-facing platform; has managed a reviewer team; has lived through a media-moment T&S crisis.
- **Ideal-source companies:** Meta, TikTok, YouTube, Discord, Reddit, Roblox, Pinterest, OpenAI (T&S), Anthropic (T&S), Stripe (Radar / risk), Substack (T&S).
- **First-90-days impact:** Reviewer team hired (4 of 8) + trained by day 60; queue SLA hit consistently by day 75; first quarterly T&S report by day 90.
- **Interview rubric (ops):** Scaling 4+, Systems 5, Conflict 5, Talent magnetism 4+, Calm 5.
- **Loop:** Legal screen â†’ policy exercise (review 10 sample artifacts, decide actions, explain) â†’ role-play (handle a media inquiry; handle a falsely-suspended customer; handle a reviewer raising a concern) â†’ working session with Legal Counsel + Founder â†’ references.
- **Comp band:** Base $140k–$165k, equity 0.2%–0.4%.
- **Location:** Remote.

---

### Role 15 — Senior Frontend Engineer

- **Level:** IC5
- **Reports to:** Founder (will report to VP Eng)
- **Mandate:** Owns design system polish, accessibility, component library at production-quality. Lifts the bar above what the founding engineers + designer set in months 1–6.
- **Primary responsibilities:**
  - Accessibility audit + remediation to WCAG 2.2 AA.
  - Design system code maturation (Radix-based component library, tokens, theming, dark mode).
  - Performance — Lighthouse / Core Web Vitals discipline.
  - Pairs with Designer #2 (role 20) once that role lands.
- **Must-have:** 6+ years frontend; has shipped a design system used by â‰¥5 other engineers; deep accessibility chops; Next.js + Radix + Tailwind fluency.
- **Ideal-source companies:** Vercel, Linear, Notion, Figma, Stripe (frontend), Radix (WorkOS), shadcn community, Cal.com, Resend, Liveblocks.
- **First-90-days impact:** Accessibility audit + plan by day 30; first round of component library hardening by day 60; design-system code parity + dark mode + Lighthouse â‰¥95 by day 90.
- **Interview rubric (engineering):** Tech depth 5, System thinking 4+, AI/LLM 3+, Ownership 4+, Comms 5.
- **Loop:** Standard engineering loop with extra weight on portfolio review (live design system walkthrough).
- **Comp band:** Base $175k–$200k, equity 0.20%–0.35%.
- **Location:** Remote.

---

## Months 9–12 — Agency + sales (roles 16–20)

### Role 16 — VP Engineering

- **Level:** M3
- **Reports to:** Founder
- **Mandate:** Engineering management — hiring rubric ownership, on-call structure, performance management, eng ops, technical bar protection. Founder gradually hands off all engineering management to this role.
- **Primary responsibilities:**
  - Own the engineering org chart (currently 8 engineers, will be 15+ by month 18).
  - Run hiring loops (replaces founder on most engineering interviews).
  - Performance management cycle (month 13 onward).
  - On-call discipline, incident reviews, post-mortems.
  - Roadmap interface with founder + customer success + sales.
- **Must-have:** 10+ years engineering, with 4+ years managing managers OR 6+ years managing ICs at â‰¥15-person scope; has built engineering teams from 5 to 25+.
- **Nice-to-haves:** Has been VP Eng at a Series A/B SaaS that scaled to $20M+ ARR.
- **Ideal-source companies:** Vercel (eng leadership), Linear (eng leadership), Notion (eng leadership), Stripe (engineering management ICs becoming VP), Cal.com, Mercury, Ramp, Retool, Figma, Loom.
- **First-90-days impact:** Org chart + hiring rubric updated by day 30; first hire owned end-to-end by day 60; founder time on eng management dropped to <20% by day 90.
- **Interview rubric (engineering + ops blend):** Tech depth 4+, System thinking 5, AI/LLM 3+, Ownership 5, Comms 5; ALSO from ops rubric — Scaling 5, Talent magnetism 5, Calm 5.
- **Loop:** Founder screen â†’ engineering panel (all founding engineers + senior eng) â†’ people-management deep-dive with founder + an outside advisor â†’ strategy session (review the eng-ops spec 08, propose 3 changes) â†’ references (must include 2 direct reports from prior role). Decision: founder lead, founding engineers veto.
- **Comp band:** Base $260k–$300k, equity 0.8%–1.5%, sign-on $50k.
- **Location:** Remote. 4h overlap US Pacific.

---

### Role 17 — Head of Sales (Agency channel)

- **Level:** IC6 / M1
- **Reports to:** Founder
- **Mandate:** Owns the agency white-label channel ($997/mo+ tier). Hires agency-channel CSMs and account executives. Closes deals personally for the first 6 months.
- **Primary responsibilities:**
  - Run outbound + inbound for agency tier; close top 10 agencies personally in first 90 days.
  - Build the agency partner program (tiers, commercials, co-marketing).
  - Hire first AE + first dedicated agency CSM (role 23) by month 14.
  - Quota carry — first year carrying personal quota.
- **Must-have:** 8+ years sales, with 3+ years closing $50k–$500k ARR deals; has sold to agencies before; has built a partner channel from zero.
- **Ideal-source companies:** GoHighLevel (sales), HubSpot (partner sales), Webflow (agency partner), Shopify Plus (agency partner), Klaviyo (agency channel), Salesforce (AppExchange partners).
- **First-90-days impact:** 10 agency logos closed by day 90; partner program v1 published by day 60; first AE hired by month 5.
- **Interview rubric (sales):** Prospecting 4+, Discovery 5, Demo skill 5, Objection handling 5, Follow-through 5.
- **Loop:** Founder screen â†’ discovery role-play (with a senior agency owner from founder's network) â†’ demo role-play (sell GoFunnelAI to a 20-person agency) â†’ strategy plan (build the agency partner program, 1 week) â†’ references (must include 2 channel-partner contacts who'll vouch for them). Decision: founder lead.
- **Comp band:** Base $180k–$210k + OTE $360k–$420k at 100% quota, equity 0.4%–0.7%.
- **Location:** Remote, US preferred. Travel-tolerant.

---

### Role 18 — PR Lead

- **Level:** IC5
- **Reports to:** Founder (dotted to Head of Content)
- **Mandate:** Owns press relations, media training for founder + execs, crisis comms execution (see 06b), launch moments for new verticals.
- **Primary responsibilities:**
  - Build press relationships across tech (TechCrunch, The Information, Bloomberg, WSJ, NYT), creator economy (Colin & Samir, Modern Wisdom), and vertical trades (per launch country/vertical).
  - Media training for the founder and execs.
  - Crisis comms execution paired with Legal + Customer Success.
  - Launch event PR (see 14-launch-event-run-of-show.md).
- **Must-have:** 5+ years PR/comms, with 2+ years in-house at a high-growth tech company; has placed founder profiles at top-tier outlets.
- **Ideal-source companies:** Stripe (comms), Anthropic (comms), OpenAI (comms), Vercel (comms), Notion (comms), Brex/Mercury/Ramp comms, top-tier PR agencies (BAM, M&C Saatchi, Brightline).
- **First-90-days impact:** Press list + first 5 placements by day 60; founder media-trained by day 90; crisis comms playbook live by day 60.
- **Interview rubric (content + ops blend):** Voice match 4+, Distribution 5, Production speed 4+, Range 4+; Calm-under-fire 5.
- **Loop:** Founder screen â†’ press strategy exercise (build a 90-day press plan for GoFunnelAI's solar vertical launch) â†’ crisis sim (we throw a fake media inquiry, watch them work) â†’ references (2 reporters who've worked with them).
- **Comp band:** Base $170k–$200k, equity 0.2%–0.4%.
- **Location:** Remote, US.

---

### Role 19 — Data Engineer

- **Level:** IC5
- **Reports to:** Founder (will report to VP Eng)
- **Mandate:** Owns the data lake (Iceberg), the recursive learning pipeline (use product to learn what converts, feed back into agent), and the ranking models that pick which funnel block to render for which audience.
- **Primary responsibilities:**
  - Stand up the Iceberg lake on R2/S3 with Cloudflare Logpush + event stream from product (see 03-event-taxonomy-and-schemas.md).
  - Build the conversion-feedback pipeline: artifact â†’ impressions â†’ engagement â†’ conversions â†’ learning back into the prompt/ranking layer.
  - Ranking models for funnel-block selection (LightGBM/XGBoost initially; embeddings-based retrieval later).
  - Partner with AI Engineer (role 1) on the feedback loop into evals.
- **Must-have:** 5+ years data engineering; has shipped a production data lake (Iceberg / Delta / Hudi); has shipped ML models in production for ranking or recommendations.
- **Ideal-source companies:** Stripe (data platform), Notion (data), Linear (data), Mercury (data), Ramp (data), Snowflake / Databricks customers, Tabular, Fivetran, Hex (eng), Mode (eng), Looker alumni.
- **First-90-days impact:** Lake + event ingestion live by day 45; conversion-feedback pipeline live with first model in production by day 90.
- **Interview rubric (engineering):** Tech depth 5, System thinking 5, AI/LLM 4+, Ownership 4+, Comms 4+.
- **Loop:** Standard eng loop with system-design weight on lake design + feedback loop.
- **Comp band:** Base $200k–$230k, equity 0.3%–0.5%, sign-on $20k.
- **Location:** Remote.

---

### Role 20 — Designer #2 (Marketing + content design)

- **Level:** IC4
- **Reports to:** Founding Designer
- **Mandate:** Marketing site, content design, brand evolution, social design system. Frees the Founding Designer to focus on product depth.
- **Primary responsibilities:**
  - Marketing site design + iteration cadence.
  - Brand evolution as product matures.
  - Social/content design system: thumbnail templates, reel templates, LinkedIn cards, X graphics.
  - Partners with Head of Content + PR on launch design.
- **Must-have:** 4+ years design, with marketing site + brand design portfolio; comfortable in Figma + after-effects/principle for motion.
- **Ideal-source companies:** Linear, Vercel, Stripe Press, Loom, Notion, Webflow, Framer, Mercury, Ramp marketing design teams.
- **First-90-days impact:** Marketing site refreshed by day 60; content design system live + 30 templates shipped by day 90.
- **Interview rubric (design):** Visual craft 5, Product thinking 3+, Brand range 5, Technical 3+, Taste 5.
- **Loop:** Founding Designer screen â†’ portfolio â†’ design exercise (redesign the GoFunnelAI marketing homepage hero in 3 directions) â†’ working session â†’ references.
- **Comp band:** Base $140k–$165k, equity 0.10%–0.20%.
- **Location:** Remote.

---

## Months 12–18 — COO + international (roles 21–25)

### Role 21 — COO

- **Level:** M3 (executive)
- **Reports to:** Founder
- **Mandate:** Operations, hiring, board interface, post-founder execution. The founder hires this role when product allocation drops below 20% and hiring allocation drops below 15% (see PART F).
- **Primary responsibilities:**
  - Run weekly leadership meeting, monthly board meeting prep, quarterly OKRs.
  - Own the hiring engine — recruiters, sourcers, hiring rubrics, comp committee.
  - Own finance + ops infrastructure (with Ops/Finance Lead, role 25).
  - Build the management layer below themselves (heads of functions).
  - Interface with the board so the founder can focus on product, content, and strategy.
- **Must-have:** 12+ years ops, with prior COO or VP Ops experience at a Series B+ SaaS; has scaled an org from 25 to 100+.
- **Nice-to-haves:** Has worked with a founder who later went IPO; international ops experience.
- **Ideal-source companies:** Notion (COO/Ops), Linear (Ops), Stripe (ops leadership), Vercel (ops), Mercury (ops), Ramp (ops), Figma (ops), Loom (ops), Webflow (ops). Also: ex-McKinsey/Bain operating partners now in tech.
- **First-90-days impact:** Leadership cadence formalized by day 30; first head-count plan rebuilt by day 60; first board meeting prep delivered + founder time-allocation shifted to plan by day 90.
- **Interview rubric (ops):** Scaling 5, Systems 5, Conflict 5, Talent magnetism 5, Calm 5.
- **Loop:** Founder screen â†’ strategy session (review the company's last 90 days, propose top 3 changes) â†’ leadership panel (all existing heads) â†’ working session with founder on the year-2 plan â†’ board reference (a current/former board member from prior co) â†’ references (5, including 2 reports). Decision: founder lead, board advisor confirm.
- **Comp band:** Base $300k–$350k, equity 1.0%–2.0%, sign-on $100k.
- **Location:** Remote, with travel. Must be willing to travel to founder's location 1 week/month.

---

### Role 22 — Head of International

- **Level:** IC6 / M1
- **Reports to:** COO (or founder if COO not yet hired)
- **Mandate:** Expansion ops — localization, partner relationships, country-launch execution (see 15-country-launch-checklists.md).
- **Primary responsibilities:**
  - Own country-launch sequencing — UK, Canada, Australia, then EU big-5, then LATAM.
  - Localization: language, currency, payment methods, legal posture (paired with Legal Counsel).
  - Partner relationships in each market (agencies, resellers, local PR).
  - Local hire planning.
- **Must-have:** 7+ years international expansion in SaaS; has launched a SaaS in â‰¥3 countries; speaks â‰¥2 languages.
- **Ideal-source companies:** Stripe (international), Notion (international), Webflow (international), Klaviyo (international), Shopify (international), Wise, Revolut (intl), Deel.
- **First-90-days impact:** Country-launch sequence approved by day 30; UK + Canada launch plans live by day 60; first international agency partner signed by day 90.
- **Interview rubric (ops):** Scaling 5, Systems 4+, Conflict 4+, Talent magnetism 4+, Calm 5.
- **Loop:** COO/Founder screen â†’ expansion strategy exercise â†’ market deep-dive (pick a market, walk us through how you'd launch) â†’ references (must include partners from prior co).
- **Comp band:** Base $200k–$235k, equity 0.4%–0.7%.
- **Location:** Remote, EU or UK preferred for timezone coverage.

---

### Role 23 — Senior Customer Success Manager (Agency tier)

- **Level:** IC5
- **Reports to:** Customer Success Lead (or Head of Sales depending on org design)
- **Mandate:** Dedicated AM for $997/mo agency-tier accounts. White-glove retention, expansion, renewal.
- **Primary responsibilities:**
  - Portfolio of 30–50 agency accounts.
  - Quarterly business reviews, expansion plays, renewal motions.
  - Voice-of-customer interface with product.
- **Must-have:** 5+ years CSM at a B2B SaaS; portfolio carry experience at $500k+ ARR portfolios; renewal + expansion track record.
- **Ideal-source companies:** GoHighLevel (CS for agency tier), HubSpot, Webflow (agency CS), Klaviyo, Shopify Plus.
- **First-90-days impact:** Portfolio assigned by day 30; first QBRs delivered by day 60; first expansion win by day 90.
- **Interview rubric (sales-ops blend):** Discovery 5, Objection handling 4+, Follow-through 5; Systems 4+; Calm 4+.
- **Loop:** CS Lead screen â†’ portfolio exercise â†’ role-play (handle a churning agency; handle an expansion conversation) â†’ references.
- **Comp band:** Base $130k–$155k + variable $30k–$50k on retention/expansion, equity 0.10%–0.20%.
- **Location:** Remote.

---

### Role 24 — Senior Engineer (Generation Engine focus)

- **Level:** IC6
- **Reports to:** VP Engineering
- **Mandate:** Agent quality, model fine-tuning, prompt engineering at depth. Lifts the orchestration engine from "shipping" to "best-in-class."
- **Primary responsibilities:**
  - Owns the eval system at maturity — golden sets per vertical, automated grading, regression dashboards.
  - Owns the fine-tuning pipeline (open-weight models for cost-sensitive paths).
  - Prompt engineering depth — RAG quality, retrieval tuning, chain-of-thought design, structured output reliability.
  - Pairs with Data Engineer (role 19) on the conversion-feedback loop.
- **Must-have:** 8+ years engineering with 3+ years on production LLM systems; has fine-tuned a model that shipped; eval-engineering depth.
- **Ideal-source companies:** Anthropic, OpenAI, Cohere, Mistral, Together.ai, Modal, Replicate, Adept, Sierra, Cresta, Harvey, Hex (AI), Notion (AI), Linear (AI).
- **First-90-days impact:** Eval coverage doubled by day 60; first fine-tuned model shipped to production by day 90; cost-per-funnel down 30% by day 90.
- **Interview rubric (engineering):** Tech depth 5, System thinking 5, AI/LLM 5, Ownership 5, Comms 4+.
- **Loop:** VP Eng + Founder screen â†’ take-home (build an eval harness for a small RAG system, 8h cap) â†’ tech deep-dive â†’ research conversation (we'll walk through a recent paper together) â†’ references.
- **Comp band:** Base $240k–$280k, equity 0.4%–0.7%, sign-on $30k.
- **Location:** Remote.

---

### Role 25 — Operations / Finance Lead

- **Level:** IC5
- **Reports to:** COO
- **Mandate:** Finance ops, billing reconciliation, vendor management, runway modeling. The financial nervous system.
- **Primary responsibilities:**
  - Monthly close, GAAP-clean books.
  - Runway model + scenario planning.
  - Billing reconciliation (Stripe â†” general ledger â†” revenue recognition).
  - Vendor management + spend governance.
  - Payroll + benefits + state/intl employer-of-record relationships.
- **Must-have:** 6+ years finance/ops at a SaaS company; has owned a monthly close; comfortable with NetSuite/QuickBooks + Stripe + Pigment/Mosaic/Causal.
- **Ideal-source companies:** Mercury, Ramp, Brex, Pilot, Stripe (finance ops), Notion (finance), Linear (finance), Pigment, Mosaic.
- **First-90-days impact:** First clean close by day 45; runway model + scenario rebuilt by day 60; vendor audit + spend report by day 90.
- **Interview rubric (ops):** Scaling 4+, Systems 5, Conflict 4+, Talent magnetism 3+, Calm 5.
- **Loop:** COO screen â†’ finance exercise (review our P&L scenario, propose 3 changes) â†’ working session â†’ references.
- **Comp band:** Base $160k–$185k, equity 0.15%–0.30%.
- **Location:** Remote, US preferred.

---

# PART B — Interview Rubrics

The rubric library is shared across roles in a family. For each rubric: dimensions, the 1–5 anchor descriptions, hire threshold, and the interview loop structure.

**Scoring conventions:** Each interviewer scores 1–5 on each dimension, with a written 2–4 sentence justification. Scorecards are submitted before debrief — no "anchoring" by reading others' first. Debrief is conducted by the hiring manager.

---

## B.1 — Engineering rubric

**Dimensions:** Technical depth, System thinking, AI/LLM understanding, Ownership, Communication.

**Technical depth:**
- 1 — Cannot complete the take-home or produces non-functional code.
- 2 — Code works but is fragile, naive, or shows weak fundamentals (sync issues, no error handling, no tests).
- 3 — Solid working code. Reasonable patterns. Would ship after review.
- 4 — Strong. Idiomatic, defensive, tested. Spots and resolves edge cases unprompted.
- 5 — Elite. Anticipates failure modes we hadn't considered. Code is the kind we'd reference in onboarding.

**System thinking:**
- 1 — Cannot reason about systems beyond a single service.
- 2 — Can describe components but misses interactions, failure modes, or data flow.
- 3 — Reasonable system design. Explains tradeoffs. Misses some non-obvious failure modes.
- 4 — Strong system reasoning. Spots non-obvious failure modes, capacity issues, and operational concerns.
- 5 — Designs systems we want to copy. Reasons about cost, capacity, observability, security, and migration concurrently.

**AI/LLM understanding:**
- 1 — Has never shipped an LLM-backed feature.
- 2 — Has used the OpenAI/Anthropic SDK in a side project; surface-level prompt knowledge.
- 3 — Has shipped one LLM feature in production. Understands tokens, temperature, costs.
- 4 — Has shipped multiple LLM features. Knows when to use RAG vs fine-tune vs prompt. Has written an eval.
- 5 — Lives inside the space. Has built eval harnesses, agentic systems, fine-tuning pipelines. Reads papers.

**Ownership:**
- 1 — Looking for someone to assign tasks.
- 2 — Will complete assigned work but doesn't extend scope or surface issues proactively.
- 3 — Owns assigned work end-to-end. Surfaces issues. Asks for help when stuck.
- 4 — Owns problems, not tasks. Defines scope, escalates well, follows through to outcome.
- 5 — Owns outcomes. Will redirect the team if the plan is wrong. Reliable for "founder-pace" work.

**Communication:**
- 1 — Cannot explain decisions clearly. Defensive when challenged.
- 2 — Explains decisions but loses non-experts. Doesn't write things down.
- 3 — Communicates clearly in conversation. Documents acceptably.
- 4 — Strong written + verbal. Documents proactively. Disagrees well.
- 5 — Communication is a multiplier — they make their teammates better.

**Hire threshold (general):** â‰¥4 on at least 4 of 5 dimensions, with no score below 3. AI/LLM score â‰¥4 is required for AI-Engineer-class roles; â‰¥3 is acceptable for full-stack/platform engineers.

**Loop:**
1. Founder/VP-Eng screen — 30 min, fit + role calibration.
2. Take-home — bounded (4–8h), reviewed by the hiring manager + one peer.
3. Tech deep-dive — 90 min, walk through the take-home + extend it live.
4. System design — 60 min, with a senior engineer or external advisor.
5. (Optional) Pair-coding round — 60 min, real codebase issue or extension.
6. References — 3, on-list, conducted by hiring manager.

**Decision rule:** Hiring manager (founder, then VP Eng) leads. Founding engineers hold veto for the first 8 hires. After VP Eng is hired, VP Eng leads; founder retains veto for senior+ hires.

---

## B.2 — Design rubric

**Dimensions:** Visual craft, Product thinking, Brand range, Technical implementation knowledge, Taste.

**Visual craft:**
- 1 — Inconsistent typography, spacing, alignment in portfolio.
- 2 — Acceptable craft but not memorable.
- 3 — Solid craft. Would ship without rework.
- 4 — Strong craft. Defaults are tasteful; details are considered.
- 5 — Reference-quality. The kind of craft that sets the company ceiling.

**Product thinking:**
- 1 — Designs without engaging with the problem.
- 2 — Considers UX but not business logic or technical constraints.
- 3 — Reasonable product instincts. Asks the right questions.
- 4 — Strong product thinking. Reframes problems. Pushes back on the brief well.
- 5 — Co-author of strategy, not just executor. Often spots the bigger opportunity.

**Brand range:**
- 1 — One look, applied everywhere.
- 2 — Limited range — can do startup-cute OR enterprise but not both.
- 3 — Comfortable range across 2–3 brand registers.
- 4 — Broad range. Has shipped both creator-friendly and enterprise-credible work.
- 5 — Could brand-direct multiple companies in different categories convincingly.

**Technical implementation knowledge:**
- 1 — Hands off Figma and disappears.
- 2 — Knows engineering will translate but not how.
- 3 — Designs with technical constraints in mind. Reads CSS.
- 4 — Strong technical fluency. Writes some HTML/CSS. Designs in a way engineers love.
- 5 — Could ship the design themselves if needed.

**Taste:**
- 1 — Defaults to trends without judgment.
- 2 — Taste is acceptable but not distinctive.
- 3 — Tasteful by industry standards.
- 4 — Distinctive taste. Choices feel intentional.
- 5 — World-class taste. The kind we'd want defining the company aesthetic.

**Hire threshold:** Founding Designer — 5 on craft AND taste, â‰¥4 on the other three. Designer #2 — â‰¥4 on craft, brand range, taste; â‰¥3 on the other two.

**Loop:**
1. Founder screen — 30 min.
2. Portfolio deep-dive — 90 min, live walk-through (not slides). Designer drives the conversation.
3. Design exercise — bounded (4h), reviewed live in a working session.
4. Working session with founder — 90 min, co-design something small.
5. References — 3, on-list.

**Decision rule:** Founder leads for the Founding Designer; Founding Designer leads for subsequent design hires.

---

## B.3 — Growth rubric

**Dimensions:** Experimentation mindset, Channel literacy, Math fluency, Copywriting, Founder-mentality.

**Experimentation mindset:**
- 1 — Pitches "best practices" without testing them.
- 2 — Runs experiments occasionally; cannot calculate significance.
- 3 — Runs experiments regularly. Logs results. Reasonable hypotheses.
- 4 — Lives in the experiment log. Sizes impact before running. Kills experiments fast when wrong.
- 5 — Built and runs an experimentation system that compounds team learning.

**Channel literacy:**
- 1 — Deep in one channel, blind to the rest.
- 2 — Comfortable in 2 channels. Can speak to others.
- 3 — Comfortable across paid, content, community, and viral loops.
- 4 — Strong across all channels with measurable wins in 3+.
- 5 — Channel-agnostic. Picks the right channel for the moment and shifts spend fluidly.

**Math fluency:**
- 1 — Cannot calculate CAC payback or LTV.
- 2 — Reasonable spreadsheet but no SQL.
- 3 — Solid spreadsheet + basic SQL. Reads a cohort chart.
- 4 — Strong analyst-grade math. SQL fluent. Builds models in Hex/Mode.
- 5 — Could be hired as the analyst. Builds the dashboards the team runs against.

**Copywriting:**
- 1 — Cannot write a converting headline.
- 2 — Writes acceptable copy with help.
- 3 — Writes solid copy. Shipped converting work.
- 4 — Writes copy that beats agencies. Multiple wins on file.
- 5 — Could be a copywriter-as-a-career. Headlines lift conversion measurably.

**Founder-mentality:**
- 1 — Wants a clear playbook handed to them.
- 2 — Can run a playbook but won't extend it.
- 3 — Owns their area. Builds playbook chunks.
- 4 — Acts like a founder. Builds systems. Owns outcomes.
- 5 — Will eventually start their own company. Will run hard for 3–5 years here in the meantime.

**Hire threshold:** Head of Growth — â‰¥4 on all five. Growth ICs (later hires) — â‰¥4 on three including experimentation and one of math/copy.

**Loop:**
1. Founder screen — 30 min.
2. Portfolio walk-through — 60 min. Show me the experiment log and the wins.
3. Growth exercise — bounded (1 week), audit GoFunnelAI's funnel + propose 5 experiments with sized impact.
4. Working session — 90 min with founder, sharpen the exercise.
5. References — 3.

**Decision rule:** Founder leads.

---

## B.4 — Content rubric

**Dimensions:** Voice match, Distribution understanding, Production speed, Founder-ghostwriting ability, Range.

**Voice match:**
- 1 — Cannot match a voice. Writing reads as generic.
- 2 — Some voice match with heavy editing.
- 3 — Reasonable voice match after a few rounds.
- 4 — Strong voice match on first or second draft.
- 5 — Indistinguishable from the founder's own writing.

**Distribution understanding:**
- 1 — Writes without thinking about distribution.
- 2 — Understands one channel.
- 3 — Designs content for the channel. Comfortable in 2–3 surfaces.
- 4 — Designs across the multi-channel surface (long â†’ short â†’ social â†’ newsletter).
- 5 — Distribution-native. Designs content so each surface feeds the next.

**Production speed:**
- 1 — Slow. Misses deadlines.
- 2 — On-time with reminders.
- 3 — Reliable cadence. Hits deadlines.
- 4 — Fast. Beats deadlines. Manages contractors well.
- 5 — Founder-pace. Could ship a campaign in 48h.

**Founder-ghostwriting ability:**
- 1 — Cannot ghostwrite — pulls toward their own voice.
- 2 — Ghostwrites with heavy editing.
- 3 — Reasonable ghostwriting after voice-onboarding.
- 4 — Strong ghostwriting. The founder shipped a piece they didn't write.
- 5 — The founder cannot tell which pieces they wrote.

**Range:**
- 1 — One format only.
- 2 — Two formats.
- 3 — Comfortable across 3 formats.
- 4 — Strong across long-form video script, podcast outline, threads, newsletter, ad copy.
- 5 — Could be hired as any of the above roles standalone.

**Hire threshold:** Head of Content — 5 on voice match + ghostwriting, â‰¥4 elsewhere. PR Lead uses content rubric with extra weight on Distribution + Calm-under-fire.

**Loop:**
1. Founder screen — 30 min.
2. Voice test — 24h turnaround, write a 600-word LinkedIn post in the founder's voice on a founder-picked topic.
3. Portfolio walk-through — 60 min.
4. Working session — 90 min, co-script a 12-min YouTube video.
5. References — 3.

**Decision rule:** Founder leads.

---

## B.5 — Sales rubric

**Dimensions:** Prospecting, Discovery, Demo skill, Objection handling, Follow-through.

**Prospecting:**
- 1 — Waits for inbound.
- 2 — Runs prospecting playbooks but doesn't customize.
- 3 — Customized outreach with reasonable response rates.
- 4 — Strong personalization. High response rates. Multi-thread accounts.
- 5 — Builds prospecting systems that compound.

**Discovery:**
- 1 — Pitches before discovering.
- 2 — Asks surface questions.
- 3 — Solid discovery with MEDDIC or similar framework.
- 4 — Deep discovery. Surfaces unspoken concerns. Maps the buying committee.
- 5 — Discovery is the sale. By the time they pitch, the buyer is already sold.

**Demo skill:**
- 1 — Walks through every feature.
- 2 — Demos to the discovery findings but uneven.
- 3 — Tight demos tied to the buyer's problem.
- 4 — Demo is a story. Buyer is leaning in.
- 5 — Demo is the highlight reel of why this customer needs us specifically.

**Objection handling:**
- 1 — Goes defensive on objections.
- 2 — Has scripted answers but no improvisation.
- 3 — Handles objections cleanly.
- 4 — Reframes objections into the close.
- 5 — Objections become commitment moments.

**Follow-through:**
- 1 — Loses deals in the gap between meetings.
- 2 — Reasonable follow-up cadence.
- 3 — Tight follow-up. CRM hygiene.
- 4 — Multi-thread, multi-touch, multi-channel follow-up. Deals don't go cold.
- 5 — Pipeline reliability is their reputation.

**Hire threshold:** Head of Sales — â‰¥4 on all five; 5 on discovery + demo. AEs (later) — â‰¥4 on three including prospecting + follow-through.

**Loop:**
1. Founder screen — 30 min.
2. Discovery role-play — 45 min with a senior agency owner from the founder's network as the "buyer."
3. Demo role-play — 45 min, sell GoFunnelAI to a fictional 20-person agency.
4. Strategy plan — 1 week, build the agency partner program.
5. References — 3 (must include 1 customer and 1 channel partner).

**Decision rule:** Founder leads.

---

## B.6 — Ops rubric

**Dimensions:** Scaling experience, Systems thinking, Conflict resolution, Talent magnetism, Calm-under-fire.

**Scaling experience:**
- 1 — Has only operated at one stage.
- 2 — Has scaled a function at one company.
- 3 — Has scaled across two stages (e.g., 25 â†’ 75 people).
- 4 — Has scaled across multiple companies/stages.
- 5 — Scaled an org from <25 to 100+ as the operating leader.

**Systems thinking:**
- 1 — Tactical. Fixes the immediate fire.
- 2 — Builds local systems but doesn't connect them.
- 3 — Designs systems that interconnect. Documents.
- 4 — Strong systems thinker. Defaults to "what's the system" before "what's the fix."
- 5 — Designs the operating system of the company.

**Conflict resolution:**
- 1 — Avoids conflict.
- 2 — Mediates when forced.
- 3 — Engages conflict cleanly.
- 4 — Surfaces and resolves conflict proactively.
- 5 — Conflict is a tool. Uses it to align the team. People feel safer after, not worse.

**Talent magnetism:**
- 1 — Cannot attract talent.
- 2 — Refers occasional candidates.
- 3 — Has hired their team successfully.
- 4 — People follow them between companies.
- 5 — Famous-in-their-niche. Recruits we couldn't otherwise reach.

**Calm-under-fire:**
- 1 — Panics in crisis.
- 2 — Functional but tense.
- 3 — Calm during normal pressure.
- 4 — Calm during real crises. Others lean on them.
- 5 — Reference-quality crisis operator. Has run a crisis at $100M+ stakes.

**Hire threshold:** COO — â‰¥5 on scaling, systems, talent magnetism, AND calm. Head of International / CS Lead / T&S Lead / Ops & Finance Lead — â‰¥4 on at least 4 of 5.

**Loop:**
1. Founder/COO screen — 30 min.
2. Strategy session — 60 min, review one part of the company, propose changes.
3. Leadership panel — 60 min with existing heads.
4. Working session — 90 min, deep-dive on a real problem.
5. References — 5, must include 2 reports.

**Decision rule:** Founder leads for COO; COO leads for subsequent ops hires.

---

## B.7 — Legal rubric

**Dimensions:** AI regulation depth, FTC familiarity, International privacy, Business-friendly judgment, Communication.

**AI regulation depth:**
- 1 — Hasn't tracked AI regulation.
- 2 — Reads headlines.
- 3 — Tracks the major frameworks (EU AI Act, US state laws, NIST AI RMF).
- 4 — Has shipped policy for a generative-AI product.
- 5 — Is a recognized voice in the space; has published.

**FTC familiarity:**
- 1 — Surface knowledge.
- 2 — Knows Â§5 unfairness/deception.
- 3 — Has handled FTC-adjacent matters.
- 4 — Has lived through an FTC inquiry.
- 5 — FTC alumna or has handled multiple inquiries to resolution.

**International privacy:**
- 1 — US only.
- 2 — GDPR awareness.
- 3 — Comfortable with GDPR + CCPA + LGPD.
- 4 — Has shipped multi-jurisdictional privacy programs.
- 5 — DPO-grade. Has run cross-border data transfer disputes.

**Business-friendly judgment:**
- 1 — "No" lawyer.
- 2 — Slow but eventually yes.
- 3 — Reasonable risk balancing.
- 4 — Finds the way to yes. Articulates risk in business terms.
- 5 — Operating partner. The team treats them as a strategist.

**Communication:**
- 1 — Writes only in legalese.
- 2 — Translates with effort.
- 3 — Communicates clearly to non-lawyers.
- 4 — Strong writer. Memos are usable directly.
- 5 — Could write the company blog post on a regulatory matter directly.

**Hire threshold:** â‰¥4 on all five; 5 on AI regulation + business-friendly judgment.

**Loop:**
1. Founder screen.
2. Written memo exercise — 1 week. Draft a memo on the publish-ack legal risk.
3. Deep-dive on memo + 3 scenario role-plays.
4. Meeting with outside counsel as a fit check.
5. References — 3, including 1 former in-house client.

**Decision rule:** Founder leads.

---

# PART C — Sourcing Strategy

**Order of operations for every role:**
1. Warm intro from founder network — always start here. 60% of first 25 hires should come from here.
2. Reverse-recruit from named companies (see below).
3. Founder content recruiting — every YouTube video, every long thread ends with "we're hiring, here's the role."
4. Public engineering / design / growth communities.
5. Specialty Slack/Discord communities.
6. Recruiters — only for specialist roles (Compliance Counsel, COO, VP Eng). Use Daversa, True, or an AI-native boutique for executive search.

---

## C.1 — Engineering sourcing

**Companies to reverse-recruit from:**
- Vercel — DX-focused engineers, Next.js depth.
- Linear — quality bar reference, design-aware engineers.
- Notion — multi-tenant SaaS experience, scale.
- Anthropic / OpenAI — applied research engineers (target the applied team, not research).
- Cloudflare — edge runtime depth.
- Stripe — platform engineers, billing depth.
- Cal.com, Resend, Liveblocks, Supabase, PlanetScale, Render — younger-cohort engineers.

**Specific targets (personas, not names):**
- Senior eng at Anthropic Applied who's been there 18+ months and wants more upside.
- Mid-senior at Vercel DX who's tired of being inside a platform and wants to build a product.
- Founding/early engineer at a YC W23–W25 cohort company that's stalled.
- Engineers active on Lex.page, Read.cv, and GitHub recently-active in `langchain`, `dspy`, `vercel/ai`, `cloudflare/workers-sdk`.

**Communities:**
- Hacker News (Who's Hiring threads).
- Lex.page network.
- Read.cv.
- Polywork (less active but still useful).
- Vercel community Discord, Cloudflare Developers Discord.
- LangChain / DSPy Discord.
- Indie Hackers (for founder-mentality engineers).
- "Latent Space" newsletter / podcast audience.
- AI Engineer Summit alumni list.

---

## C.2 — Design sourcing

**Companies:**
- Linear, Notion, Vercel, Stripe, Figma, Loom, Framer, Webflow, Arc, Raycast, Superhuman.

**Specific:**
- Mid-senior product designer at Linear who's been there 2+ years.
- Brand designer at Stripe Press / Vercel marketing.
- Founding designer alumni from any company in our reference set who's spinning off.

**Communities:**
- Designer Hangout (Slack).
- Friends of Figma local chapters.
- Read.cv (designers).
- Site Inspire.
- Brand New (mostly inspiration but the comments section is a roster).
- "Design Details" podcast network.

---

## C.3 — Growth sourcing

**Companies:**
- Notion (growth), Loom, Vercel (growth), Cal.com, Webflow, Beehiiv, Substack, ConvertKit, Skool, GoHighLevel, ClickFunnels, Acquisition.com portfolio companies, Hormozi alumni.

**Specific:**
- Growth lead from a creator-economy company that's plateaued.
- Solo growth marketer at a Series A company who's outgrown the role.
- Hormozi or Acquisition.com alum 2+ years post-stint.

**Communities:**
- Demand Curve community.
- Reforge alumni Slack.
- "Demand Brief" newsletter audience.
- Growth Mentor.
- Indie Hackers (PLG threads).
- Trends.vc community.

---

## C.4 — Content sourcing

**Companies / alumni:**
- Acquisition.com (Hormozi) content team alumni.
- Beehiiv, Morning Brew, The Hustle, Workweek, Every.
- Colin & Samir adjacent, Modern Wisdom production team, Cleo Abram team.
- Lenny's Newsletter content team.
- MrBeast Studios alumni (for production speed).

**Specific:**
- A Hormozi alumni 1+ year post-stint who can ghostwrite at his volume.
- A YouTube channel manager from a 500k+ sub channel who wants in on equity.
- A newsletter operator from Beehiiv who's grown someone else's list to 100k+.

**Communities:**
- Trends.co community.
- Creator Economy Slack / Discord communities.
- Substack writer network.
- Beehiiv operator Slack.
- "Modern Wisdom Producer Network" (informal).

---

## C.5 — Sales sourcing

**Companies:**
- GoHighLevel (especially partner-channel sales).
- HubSpot (Solutions Partner team).
- Webflow (agency partner team).
- Shopify Plus (agency channel).
- Klaviyo (agency channel).
- Salesforce (AppExchange partner sales).

**Specific:**
- Agency-channel sales lead at GHL 2+ years in.
- HubSpot Solutions Partner manager who's built relationships with 100+ agencies.

**Communities:**
- Pavilion (sales).
- RevGenius.
- "Sales Hacker" community.
- Bravado.

---

## C.6 — Ops sourcing

**Companies:**
- Notion, Linear, Stripe, Mercury, Ramp, Vercel, Figma, Loom (all at the COO/VP Ops layer).
- McKinsey/Bain alumni now operating partners at PE-backed SaaS.
- Operating partners at a16z / Sequoia / YC for COO references.

**Specific:**
- VP Ops at a Series B SaaS that's about to be acquired (timing).
- Chief of Staff at a recently IPO'd tech co who's ready to operate.

**Recruiters:** Daversa Partners, True Search, or Riviera Partners for COO/VP Eng.

**Communities:**
- The Operations Room (Slack).
- Chief Network.
- Bain / McKinsey alumni networks.

---

## C.7 — Legal sourcing

**Companies / firms:**
- Anthropic, OpenAI, Stripe, Notion, Figma legal departments.
- Stability / Runway / Midjourney legal.
- Fenwick, Cooley, Wilson Sonsini, Goodwin AI practice associates 5–8 years in.
- FTC consumer-protection division alumni.

**Specific:**
- An associate at Fenwick AI practice who wants to go in-house.
- An in-house counsel at a Series A AI startup that's stalled.

**Communities:**
- TechGC Slack.
- IAPP for privacy/AI.
- "AI Snake Oil" / "Lawfare" reader communities for AI-policy-aware lawyers.

---

# PART D — Compensation Philosophy

## D.1 — Bands

**Founding team (roles 1–4):** Below-market base (15–25% below SF-market for the level), above-market equity (1.25%–3.0% each). Rationale: maximum equity capture, deep alignment.

**Senior team (roles 5–15):** Market base, above-market equity (0.20%–0.80%). Rationale: still building the company; equity should compensate for risk.

**Specialists (roles 16–25, non-executive):** Market base, market equity (0.05%–0.30%). Rationale: the company has more proof-points by this stage; cash compensation can be more competitive.

**Executives (VP Eng, Head of Sales, COO):** Market base, above-market equity (0.5%–2.0%). Rationale: these hires shape the second-act company.

## D.2 — Vesting

- 4-year vest with a 1-year cliff (standard).
- Monthly vest after the cliff.
- Double-trigger acceleration on acquisition (acquisition + termination without cause or material role change).
- Single-trigger 25% acceleration for founding team (roles 1–4) on acquisition — they took the highest risk.

## D.3 — Cash conservation tactics

**Months 1–12 — bootstrap mindset:**
- Below-market cash for the first 4 hires.
- Equity-heavy offers across the board.
- Sign-on bonuses small ($15k–$30k) and back-loaded with 12-month clawback.
- Hire in lower-cost geographies where role allows (see geographic adjustment).

**Months 12+ — post-raise (or post-revenue traction):**
- Move to market cash for new hires.
- Run a market-rate refresh for existing team members on their 1-year anniversary (cash, not equity).
- Equity refresh cycle starts year 4.

## D.4 — Geographic adjustment

Comp bands published are SF/NY-baseline (Ã— 1.0). Multipliers:

| Region | Multiplier | Notes |
|---|---|---|
| SF Bay / NYC | 1.0 | Baseline |
| US Tier-2 (Austin, Denver, Seattle, LA, Boston, Chicago) | 0.85 | |
| US Tier-3 / remote-US | 0.80 | |
| Canada (Toronto, Vancouver) | 0.80 | |
| UK (London) | 0.80 | |
| EU (Western — Berlin, Amsterdam, Paris) | 0.75 | |
| EU (Eastern — Warsaw, Prague, Lisbon) | 0.65 | |
| LATAM (Mexico City, SÃ£o Paulo, Buenos Aires) | 0.55 | |
| Asia (Singapore, Tokyo) | 0.75 | |
| Asia (India, Vietnam, Indonesia) | 0.55 | |

**Equity is NOT geographically adjusted.** Same equity grants worldwide for the same role and level.

## D.5 — Equity refresh

- Year 4: top-performers (top-quartile by perf review) get a refresh grant equal to 25–50% of their original grant, vesting over 4 years from refresh date.
- Year 5+: refresh on the same cadence for top performers; promotion-triggered refresh available off-cycle.

## D.6 — Annual review

- First review cycle in month 13 (after first 12 months).
- Calibration committee: Founder + COO + relevant function heads.
- Outputs: comp adjustment (cash), equity refresh (if applicable), promotion (if applicable), performance plan (if needed).

---

# PART E — Onboarding Per Role (30/60/90)

The skeleton below applies to every role; role-specific deliverables are noted under each role's "first-90-days impact" in PART A. This section codifies the shared structure.

## E.1 — Days 1–30: Ramp

**Day 1:**
- Welcome packet (company values, team org, top-of-mind problems).
- Read the entire `funnel-ai-docs/` library (priority order: 12-prd-pack-v1, 08-engineering-ops-spec, 03-event-taxonomy, 06a-customer-success-activation-framework, 13-agency-enablement-kit, then role-specific docs).
- Equipment, accounts, accesses (handled by IT contractor until role 25 is hired).
- 30-min welcome with founder.

**Week 1:**
- Shadow shifts: 1Ã— with Customer Success, 1Ã— with Engineering on-call, 1Ã— with Community.
- Meet every existing teammate (15 min each).
- Set up tools, get into the codebase / Figma / Notion / Linear.

**Weeks 2–4:**
- First deliverable scoped (small, shippable, real).
- Manager 1:1 cadence locked (weekly, 30 min).
- Founder 1:1 booked for day 30.
- Onboarding buddy assigned (a peer who isn't the manager).

**Day 30 checkpoint:** Has the new hire shipped their first deliverable? Have they met everyone? Do they understand the current top-3 priorities of the company?

## E.2 — Days 31–60: Contributing

**Days 31–45:**
- First solo project assigned (a clearly-scoped, role-defining deliverable).
- New hire begins to own meetings (not just attend).
- Cross-functional partnership starts (one project that touches another team).

**Days 46–60:**
- First solo project ships.
- New hire writes a "30-day reflection" — what's working, what isn't, what they'd change.
- Manager + founder review the reflection; adjust scope if needed.

**Day 60 checkpoint:** Has the new hire shipped the first solo project? Are they integrated into the team's rhythm? Are they raising issues we hadn't seen?

## E.3 — Days 61–90: Owning

**Days 61–75:**
- Full responsibility transferred. The new hire owns their function (with manager support, not direction).
- Quarterly OKRs include their commitments.
- They're hiring (or recruiting) for their own future team if applicable.

**Days 76–90:**
- 90-day performance review with manager and founder.
- "What good looks like at 90 days" rubric per role (see PART A role packets).
- Decision: continue, performance-improvement plan, or exit. Decisions to part ways should happen by day 90, not at month 6.

**Day 90 "what good looks like" checkpoint (universal, on top of role-specific):**
- Has shipped the role's first-90-days impact targets (see role packet).
- Is owning an area without daily manager direction.
- Is a culture-add — others want to work with them.
- Has surfaced at least one improvement to how we work.

## E.4 — Reading list (every role, in order)

1. 12-prd-pack-v1.md (product context).
2. 08-engineering-ops-spec.md (how we run engineering).
3. 03-event-taxonomy-and-schemas.md (the data model).
4. 06a-customer-success-activation-framework.md (the customer journey).
5. 13-agency-enablement-kit.md (the agency channel).
6. 07a-trust-and-safety-policy.md + 07b-human-review-queue.md + 07c-cost-governor.md (the safety stack).
7. 04-integration-matrix-and-pal.md (the integration model).
8. 09-founder-content-pack.md (the founder content engine).
9. 10-website-and-onboarding-copy.md (the brand voice).
10. This doc (24-hiring-playbook.md).

---

# PART F — Founder Time Allocation

The founder's time is the bottleneck behind everything in this doc. The hiring sequence is designed around freeing founder capacity in the right order.

## F.1 — Time allocation by month

| Month | Product | Hiring | Sales | Legal | Content | Press / Community | Strategy | Fundraising | Team |
|---|---|---|---|---|---|---|---|---|---|
| 1–3 | 60% | 20% | — | 10% | 10% | — | — | — | — |
| 4–6 | 40% | 25% | 15% | 10% | 10% | — | — | — | — |
| 7–12 | 25% | 25% | 20% | — | — | 15% | 15% | — | — |
| 12+ | 15% | 20% | — | — | — | 25% | 20% | 20% | 20% |

The "Team" allocation that appears in month 12+ is leadership development, 1:1s with the heads-of-function, and culture work. It only appears once the management layer exists.

## F.2 — COO trigger

Hire the COO when **both** of the following are true for 2 consecutive months:
- Founder's product allocation drops below 20%.
- Founder's hiring allocation drops below 15%.

Both signals together mean the founder is capacity-constrained on both creation (product) and capacity-building (hiring), which is the moment when the COO unlocks the most leverage.

## F.3 — Founder discipline

- Block 4 hours/day on product, calendar-protected, no meetings.
- One "hiring day" per week — back-to-back interviews, debriefs, and reference calls. No engineering on hiring days.
- Content shoot days batched (2 days/month, captured by Head of Content).
- Press / podcast: max 4 hours/week until month 7; then up to 8 hours/week.
- Saturday morning: weekly review with COO (when hired).

---

# PART G — Founders + First-25 Equity Allocation

## G.1 — Capitalization model (post-Series A, fully diluted)

| Bucket | Range | Notes |
|---|---|---|
| Founder(s) | 60%–70% | Single founder model. If co-founder added later, split per agreement. |
| Founding team (roles 1–4) | 5%–12% total | 1.25%–3.0% each. |
| Senior team (roles 5–15) | 4%–7% total | 0.20%–0.80% each. |
| Specialists (roles 16–25, non-exec) | 1.5%–3% total | 0.05%–0.30% each. |
| Executive (VP Eng, Head Sales, COO) | 2%–4% total | 0.5%–2.0% each. |
| Advisors | 0.5%–2% total | Across 3–5 advisors. |
| Option pool (for hires 26+) | 5%–8% post-Series-A refresh | Topped up at each financing. |

Total checks: founder + team + advisors â‰ˆ 80%–90%; investor stakes (Series A + any pre-A SAFEs) fill the remainder.

## G.2 — Advisor program

- 3–5 advisors total.
- Each: 0.1%–0.5%, 2-year vest, no cliff, monthly vest.
- Categories: AI/research, growth, creator/content, sales/enterprise, legal/regulatory.
- Reviewed at year 2 — non-active advisors stop vesting (defined activity threshold: 1 meeting/quarter + 2 intros/year).

## G.3 — Founder's offer-letter terms (template)

Every offer letter for a founding-team hire (roles 1–4) includes:
- Title, level, reports-to, start date.
- Base salary, equity grant (in shares + % of fully diluted at the time of grant).
- Vesting schedule (4yr, 1yr cliff, monthly thereafter, double-trigger accel on acquisition, 25% single-trigger accel for roles 1–4).
- IP Assignment Agreement (signed at start; assigns all work-product IP).
- Confidentiality / NDA.
- Non-compete: where enforceable (and tailored — not US-blanket, given enforceability variance). Default to non-solicit of customers + employees for 12 months.
- At-will employment statement (US).
- Right to participate in next financing as an employee (typically through 83(b) election and standard ISO grants).

Roles 5–25 use a similar template, scaled down for the equity range and without single-trigger acceleration.

## G.4 — 83(b) reminder

Every hire receiving an equity grant must file the 83(b) election within 30 days of grant. This is automated as a Day-7 calendar reminder in the new hire onboarding flow, with Legal Counsel providing a template.

---

# PART H — Diversity + Inclusion

## H.1 — Targets

Across the first 25 hires:
- **40% women or non-binary** in the hired class.
- **30% BIPOC** in the hired class.
- **20% international** (non-US).

These are aggregate targets, tracked monthly. They are commitments, not quotas — we will not lower the bar to hit them, but we will widen the pipeline aggressively to surface candidates we'd otherwise miss.

## H.2 — Pipeline tracking

Every role tracks candidate demographics at five stages (self-reported, optional, anonymized in aggregate):
1. Top-of-funnel (applications + sourced).
2. Phone screen.
3. On-site / loop.
4. Offer.
5. Hire.

We report drop-off ratios at each stage by demographic. If any group drops off disproportionately at a specific stage, the hiring manager re-audits that stage's evaluation criteria for bias.

## H.3 — Sourcing channels for diverse pipeline

- **HBCU career centers** — same network as the college pilot (see role 13). Specifically: Howard, Spelman, Morehouse, FAMU, North Carolina A&T, Hampton. Target schools annually for both academy partnerships and engineering pipeline.
- **/dev/color** (Black engineering community).
- **POCIT** (People of Color in Tech).
- **Latinas in Tech, Latinx in AI.**
- **Women Who Code, AnitaB.org, Tech Ladies.**
- **Out in Tech** (LGBTQ+ tech community).
- **TransTech Social Enterprises.**
- **Code2040** (Latinx + Black engineering pipeline).
- **All Raise** (for senior women in tech).
- **Lesbians Who Tech + Allies** conference network.
- **Latinas in Tech Slack, Black Women Talk Tech Slack.**

For international pipeline:
- **Toptal-Africa networks, Andela alumni, Pesto Tech alumni** (India), **CodeOp** (Barcelona-based, women in tech), **Lighthouse Labs Latam.**

## H.4 — Inclusive practices

- **Job descriptions:** audited for biased language using a tool like Textio or Gender Decoder before each posting.
- **Loop composition:** every loop has at least one underrepresented panelist where possible.
- **Structured interviews:** rubric-driven (PART B), to reduce affinity bias.
- **Compensation parity:** comp by role Ã— experience, audited annually. Any pay gap by demographic triggers immediate true-up.
- **Pay transparency:** the comp bands in PART A are shared with every candidate at the offer stage. Internally, bands are visible to all employees from day one.
- **Feedback to declined candidates:** for any candidate who reaches the loop and is declined, we provide written feedback within 7 days. (Skipped for screen-stage declines for time reasons.)

## H.5 — Annual audit

- Comp audit: every January, a third-party audits comp parity by role Ã— experience Ã— demographic.
- Hiring funnel audit: quarterly review of the demographic drop-off by stage; outputs shared with the leadership team.
- Outputs shared with the team (anonymized): hires by demographic, comp parity ratios, time-to-hire by demographic.

---

## Appendix A — Quick-reference: who is the founder interviewing this week?

Use this as the founder's weekly hiring sprint planner. The cell answers "what is the next active loop?"

| Month | Active loops |
|---|---|
| 1 | Role 1 (AI Eng), Role 2 (Full-Stack) — both in active loop |
| 2 | Role 1 (offer/start), Role 3 (Founding Designer), Role 4 (Platform Eng) |
| 3 | Role 3 (start), Role 4 (start), Role 5 (Head of Growth) loop opens |
| 4 | Roles 5, 6 (Head of Content), 7 (Community), 8 (Legal Counsel) |
| 5 | Roles 7, 8, 9 (CS Lead) |
| 6 | Roles 8, 9 close; Role 10/11 (Mobile) loops open |
| 7 | Roles 10, 11, 12 (DevOps) |
| 8 | Roles 13 (Education), 14 (T&S), 15 (Sr Frontend) |
| 9 | Role 16 (VP Eng) — highest-priority loop |
| 10 | Roles 16, 17 (Head of Sales) |
| 11 | Roles 18 (PR), 19 (Data Eng), 20 (Designer #2) |
| 12 | Role 21 (COO) loop opens — only when trigger conditions met (PART F.2) |
| 13–15 | Roles 21, 22 (Intl), 23 (Sr CSM) |
| 16–18 | Roles 24 (Sr Eng), 25 (Ops/Finance Lead) |

## Appendix B — One-page founder cheat sheet

- **Always-on:** read the docs library (PART E.4), keep a "1-paragraph pitch per role" file in Notion, message 1 new candidate per day, refresh "we're hiring" CTA in every published piece of content.
- **Every Monday:** review hiring funnel dashboard with whoever's recruiting-on-point.
- **Every Friday:** post role updates publicly (X + LinkedIn + community).
- **Day 1 for any new hire:** founder 30-min welcome on the calendar, hand them this doc.
- **Day 90 for any new hire:** founder + manager review, decide continue/PIP/exit.
- **Hire the COO when:** product < 20% AND hiring < 15% for 2 months running.

— End of 24-hiring-playbook.md —
