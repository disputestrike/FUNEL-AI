# 11 — Help Center Starter (Launch Set)

**Owner:** Customer Success + Content Ops
**Audience:** GoFunnelAI customers (logged-in product users)
**Purpose:** Self-serve answers to "how do I do X in GoFunnelAI" so users resolve common questions without opening a ticket.
**NOT this:** GoFunnelAI Academy — that's marketing education ("how to think about funnels"). Help Center is product mechanics ("which button do I click").
**Voice:** Warm, confident, slight wit, jargon-free. Slightly more direct than the marketing site — users came for an answer, not a pitch.
**Launch state at Day 90:** 30 articles live, IA complete, search wired, scaling plan to 100+ by Month 3.

URL: `help.gofunnelai.com`

---

## PART A — Information Architecture

### A1. Top-Level Categories (10)

| # | Category | Slug | Icon (emoji placeholder, will be replaced by icon set) | One-line description |
|---|---|---|---|---|
| 1 | Getting started | `/getting-started` | rocket | First funnel, first domain, first invite — the 0-to-running path. |
| 2 | Generating funnels | `/generating` | sparkles | Quality score, regeneration, voice personas, edits. |
| 3 | Publishing | `/publishing` | globe | Going live: subdomains, custom domains, SSL. |
| 4 | Custom domains | `/domains` | link | DNS, CNAME, troubleshooting domain connections. |
| 5 | Ad accounts | `/ads` | target | Meta, Google, TikTok, LinkedIn — connection and budget. |
| 6 | CRM + Leads | `/crm` | inbox | Viewing, scoring, responding to, and exporting leads. |
| 7 | RevTry voice | `/revtry` | phone | The voice agent that calls your inbound leads. |
| 8 | Billing & plans | `/billing` | card | Free tier, Pro Boost, paid plans, upgrades, cancellation. |
| 9 | Account & security | `/account` | shield | MFA, password resets, team roles, sessions. |
| 10 | Compliance & AI disclosure | `/compliance` | scales | Disclosure footer, human review queue, GDPR, regulated verticals. |

### A2. Sub-Categories

**1. Getting started**
- Welcome & product tour
- Your first funnel
- Bringing your domain
- Inviting your team
- Common Day-1 questions

**2. Generating funnels**
- How generation works (the agent loop, 30,000-ft view)
- Quality scoring
- Regeneration (full and partial)
- Editing without rebuilding
- Voice personas (Funnel, Maven, Coach, Rebel, Maestro)
- When generation fails

**3. Publishing**
- Publish-acknowledgment flow
- Subdomain publishing (`yourname.funnel.app`)
- Custom domain publishing
- SSL / HTTPS
- Unpublishing and reverting

**4. Custom domains**
- DNS basics (you can skip the theory and still succeed)
- CNAME setup for the major registrars (GoDaddy, Namecheap, Cloudflare, Google Domains, Squarespace, IONOS)
- Apex domain vs www
- Verification status states
- Disconnecting a domain

**5. Ad accounts**
- Meta Ads (Facebook + Instagram)
- Google Ads
- TikTok Ads
- LinkedIn Ads
- Permissions and what we access
- Daily budget caps and the Cost Governor
- Ad rejections and appeals

**6. CRM + Leads**
- Lead inbox basics
- Lead scoring (the 0-100 model)
- Replying inside GoFunnelAI
- Email + SMS forwarding
- Tagging and stages
- CSV export
- Webhook / Zapier / Make / native CRM sync

**7. RevTry voice**
- What RevTry is and when it dials
- Customizing the script
- Voice selection
- Call recordings and transcripts
- Minutes, overages, and add-ons
- Compliance (TCPA, two-party consent, do-not-call)

**8. Billing & plans**
- Plan comparison
- Free tier
- Pro Boost (the seven-day full-feature trial)
- Paid plans
- Upgrading / downgrading / proration
- Pausing
- Cancellation and what happens to your stuff
- Refunds

**9. Account & security**
- Login methods
- MFA setup
- Password reset
- Team roles (Owner, Admin, Editor, Viewer)
- Session management and forced sign-out
- Audit log

**10. Compliance & AI disclosure**
- The AI disclosure footer (what it says, why it's there)
- Human review queue: why funnels get held
- Regulated verticals (health, finance, legal, gambling, cannabis)
- Claim triggers and the Compliance agent
- GDPR / CCPA: data export, deletion, DPA
- DMCA and content disputes

### A3. Search Functionality Requirements

**Engine:** Algolia DocSearch (or equivalent — Typesense as fallback).

**Must-haves at launch:**
1. **Instant search** — results render under 200 ms p95 as the user types.
2. **Typo tolerance** — "conect doman" returns "Connect your custom domain."
3. **Synonyms dictionary** — pre-seeded with: ad/ads/advertising, funnel/landing page, lead/prospect/contact, MFA/2FA/two-factor, CRM/inbox/leads, RevTry/voice agent/AI caller, cancel/cancellation/unsubscribe, refund/money back, SSL/HTTPS/certificate, domain/URL/website.
4. **Category filter** — left rail filter by top-level category.
5. **Result preview** — snippet with the matched phrase highlighted.
6. **"No results" fallback** — shows the top 5 most-viewed articles, plus a "Contact support" CTA, plus a "Submit a topic request" link that auto-creates a backlog ticket.
7. **Search analytics** — log every query, especially zero-result queries. The zero-result list is reviewed weekly by Content Ops (see Part E).
8. **Keyboard shortcut** — `/` or `Cmd/Ctrl + K` opens search from anywhere on `help.gofunnelai.com`.
9. **Mobile** — full-screen modal on screens under 768 px.
10. **Logged-in personalization** — if user is signed in to the product, results can surface workspace-specific links (e.g., their domain settings page) inline.

### A4. Article Metadata Schema

Every article — without exception — ships with the following front-matter:

```yaml
---
title: "Connect your custom domain"
slug: "connect-custom-domain"
category: "getting-started"
subcategory: "bringing-your-domain"
last_updated: 2026-05-20
author: "Customer Success"
reviewer: "Eng"          # engineering review required for technical articles
status: "published"      # draft | in-review | published | archived
target_keyword: "connect custom domain to gofunnelai.com"
meta_title: "How to connect your custom domain to GoFunnelAI"
meta_description: "Point your domain at your GoFunnelAI funnel in under five minutes. CNAME setup, SSL, and a fix for every common DNS error."
related_articles:
  - "pointing-your-custom-domain-cname-setup"
  - "ssl-provisioning-and-what-to-do-if-it-fails"
  - "publishing-to-a-subdomain-vs-custom-domain"
estimated_read_minutes: 4
predicted_traffic_tier: "high"   # high | medium | low — used for prioritization
schema_type: "HowTo"     # HowTo | FAQ | Article
support_ticket_deflection_score: 0   # populated quarterly from support data
---
```

Last-updated date is auto-bumped any time a published article is edited. Articles older than 180 days surface a "Reviewed recently?" check in the Content Ops dashboard.

---

## PART B — 30 Launch Articles (Titles + Outlines)

Each outline below: **title / slug / category / target keyword / structure (intro, steps, screenshots, troubleshooting, related).** Word counts shown are target draft lengths.

### 1. Create your first funnel in 60 seconds
- **Slug:** `create-your-first-funnel-in-60-seconds`
- **Category:** Getting started
- **Keyword:** "create funnel gofunnelai.com"
- **Outline (target 1,400 words — fully written in Part C):**
  Intro: what a "funnel" means in GoFunnelAI. Steps: sign in, click New Funnel, describe your offer in 1 sentence, optionally upload a logo, hit Generate, watch the agents work, preview, publish. Screenshots: New Funnel button, brief prompt input, generation progress view, preview, Publish button. Troubleshooting: stuck at 99%, blank preview, "I want to change something." Related: regeneration, voice personas, publishing.

### 2. Connect your custom domain
- **Slug:** `connect-your-custom-domain`
- **Category:** Getting started
- **Keyword:** "connect custom domain funnel ai"
- **Outline (~900 words):** Intro: why a custom domain matters for conversion + trust. Steps: open Domains in workspace settings, click Add, paste your domain, copy the CNAME record we show you, paste into your DNS host, click Verify, wait 5-30 min for propagation, confirm SSL. Screenshots: Add Domain dialog, the two DNS records we display, the verification status pill (Pending / Verified / Failed). Troubleshooting: "Verification keeps failing," CNAME-at-apex issue, Cloudflare proxy orange-cloud problem, SSL pending more than an hour. Related: CNAME setup deep dive, SSL provisioning, subdomain vs custom.

### 3. Invite your team
- **Slug:** `invite-your-team`
- **Category:** Getting started
- **Keyword:** "invite team funnel ai"
- **Outline (~700 words):** Intro: roles overview (Owner / Admin / Editor / Viewer) — what each can do, in one sentence. Steps: workspace settings â†’ Team â†’ Invite, enter email, choose role, send. Screenshots: Team settings page, role picker dropdown, the email the invitee receives. Troubleshooting: invite never arrives (spam, wrong email domain), revoking an invite, changing someone's role, removing a member who left the company. Related: account security, MFA, audit log.

### 4. What is the quality score and how is it calculated?
- **Slug:** `what-is-the-quality-score`
- **Category:** Generating funnels
- **Keyword:** "funnel ai quality score"
- **Outline (target 1,500 words — fully written in Part C):**
  Intro: every funnel ships with a 0-100 quality score. Below 80 we auto-regenerate. Here's exactly what goes into it. The 9 sub-scores: offer clarity, headline strength, social proof density, CTA hierarchy, mobile rendering, accessibility, brand consistency, compliance safety, technical performance. How each is measured (model + heuristic blend). Why the 80 threshold. How to read the score-card panel in the editor. Troubleshooting: "my score won't go above X," "I disagree with the score." Related: regeneration, editing, voice personas.

### 5. How to regenerate a section of your funnel
- **Slug:** `regenerate-a-section`
- **Category:** Generating funnels
- **Keyword:** "regenerate section funnel"
- **Outline (~800 words):** Intro: you don't need to rebuild the whole thing to fix one block. Steps: hover the block, click the sparkle icon, choose Regenerate, optionally pass an instruction ("make the hero punchier, keep the metric"), confirm. Screenshots: hover state on a hero block, sparkle menu, instruction input, before/after diff view. Troubleshooting: "the regen looks identical," "the regen changed something I didn't want changed," credit cost. Related: editing without rebuilding, quality score.

### 6. Editing your funnel without rebuilding from scratch
- **Slug:** `editing-without-rebuilding`
- **Category:** Generating funnels
- **Keyword:** "edit funnel page funnel ai"
- **Outline (~900 words):** Intro: in-line edits, brand swaps, copy tweaks — none of these trigger a full regeneration. Steps for each: text edit (click + type), image swap (click image, upload or pick from library), color/brand swap (workspace â†’ Brand â†’ save â†’ apply), section reorder (drag the handle). Screenshots: inline text editor, image library, brand panel, drag handle. Troubleshooting: "edits aren't saving" (browser cache / unstable connection), "the AI overrode my edit on next generation" (lock the section). Related: regeneration, brand setup, voice personas.

### 7. Switching voice personas (Funnel, Maven, Coach, Rebel, Maestro)
- **Slug:** `switching-voice-personas`
- **Category:** Generating funnels
- **Keyword:** "funnel ai voice personas"
- **Outline (~900 words):** Intro: five distinct voices. One-line on each: Funnel (the house default — direct, warm, slight wit), Maven (expert-credentialed, evidence-led), Coach (encouraging, second-person, action-oriented), Rebel (challenger, contrarian framing, never crude), Maestro (premium, restrained, status-signaling). Steps to switch: workspace â†’ Brand â†’ Voice, pick, regenerate (or apply to next gen). Screenshots: persona picker with preview snippets for the same offer. Troubleshooting: "Rebel feels too aggressive" (intensity dial), "Maestro is too vague" (combine with claim-strict mode). Related: editing, quality score.

### 8. My funnel didn't generate — what to do
- **Slug:** `funnel-didnt-generate`
- **Category:** Generating funnels
- **Keyword:** "funnel ai generation failed"
- **Outline (~700 words):** Intro: rare but it happens. Three things it usually is. Steps to recover: check the status banner, retry from the Funnel page, if it fails twice, edit the brief and retry, if it still fails, contact support with the funnel ID. Screenshots: error state UI, retry button location, funnel ID in URL. Troubleshooting: timeouts (large image uploads), claim-trigger holds (compliance), KB pack missing for vertical. Related: human review queue, compliance.

### 9. Pointing your custom domain (CNAME setup)
- **Slug:** `pointing-your-custom-domain-cname-setup`
- **Category:** Publishing
- **Keyword:** "cname setup funnel ai"
- **Outline (~1,000 words):** Intro: CNAME in one sentence: a DNS record that points your domain at ours. Steps: copy the host and value we show you in-app, log in to your DNS host, find the DNS / Records / Zone area, add a CNAME, paste host and value, TTL of 300 or Auto, save, return to GoFunnelAI, click Verify. Screenshots: GoDaddy DNS panel, Namecheap Advanced DNS, Cloudflare DNS table, Google Domains records. Troubleshooting: apex / root domain (use ALIAS or ANAME or follow our www-redirect path), Cloudflare proxy must be DNS-only at first, conflicting AAAA / A records, TTL caching. Related: SSL provisioning, connect your custom domain, publishing to subdomain vs custom.

### 10. SSL provisioning and what to do if it fails
- **Slug:** `ssl-provisioning-and-what-to-do-if-it-fails`
- **Category:** Publishing
- **Keyword:** "ssl certificate failed funnel ai"
- **Outline (~800 words):** Intro: we issue SSL automatically via Let's Encrypt the moment your CNAME verifies. Usually under 60 seconds. Sometimes it sticks. Steps: confirm the CNAME is verified, wait up to 60 minutes, click Retry SSL. Screenshots: SSL status pill states (Pending / Issued / Failed), Retry button. Troubleshooting: CAA records blocking Let's Encrypt, Cloudflare proxy issuing its own cert, mixed-content warnings after issue. Related: CNAME setup, custom domain.

### 11. Publishing to a subdomain vs custom domain
- **Slug:** `subdomain-vs-custom-domain`
- **Category:** Publishing
- **Keyword:** "publish subdomain or custom domain"
- **Outline (~700 words):** Intro: both work. Subdomain (`yourname.funnel.app`) ships in one click and is fine for testing. Custom (`offer.yourbrand.com`) converts better and is what you want for real traffic. Side-by-side comparison: setup time, SSL, conversion lift, branding, removability. Screenshots: publish dialog showing both options, the URL chooser. Troubleshooting: "I published to a subdomain — can I switch to custom later?" (yes, in two clicks; old URL 301-redirects automatically). Related: custom domain, CNAME.

### 12. Connecting your Meta Ads account
- **Slug:** `connect-meta-ads-account`
- **Category:** Ad accounts
- **Keyword:** "connect meta ads funnel ai"
- **Outline (target 1,500 words — fully written in Part C):**
  Intro: connecting Meta unlocks one-click ad creation and pixel-based lead attribution. Steps: workspace â†’ Integrations â†’ Meta â†’ Connect â†’ OAuth screen â†’ select Business Manager â†’ select ad account â†’ select pixel â†’ finish. Screenshots: Meta connect tile, Facebook OAuth screen, ad account selector, pixel selector, success state. Troubleshooting: "I don't see my ad account," pixel mismatch, permission denied, two-Business-Manager confusion, ad account on cooldown. What we access vs don't access table. Related: Google Ads, ad rejection, budget cap.

### 13. Connecting Google Ads
- **Slug:** `connect-google-ads`
- **Category:** Ad accounts
- **Keyword:** "connect google ads funnel ai"
- **Outline (~1,000 words):** Intro: Google connect via OAuth + customer ID. Steps: Integrations â†’ Google Ads â†’ Connect, sign in to Google, grant scopes, paste your 10-digit Google Ads customer ID (where to find it), select the linked account. Screenshots: Google OAuth, customer ID location in Google Ads UI, success state. Troubleshooting: MCC vs direct account, "developer token required" (not for managed flows — explain), conversion action mapping. Related: Meta connect, ad rejection.

### 14. Why was my ad rejected (and how to fix it)?
- **Slug:** `ad-rejected-how-to-fix`
- **Category:** Ad accounts
- **Keyword:** "meta ad rejected fix"
- **Outline (target 1,700 words — fully written in Part C):**
  Intro: rejection is normal, fixable, and almost always about wording. Meta and Google policy crash course (the 8 categories that account for ~85% of rejections). How our Compliance agent pre-flights every ad before submit. The three actions when one still gets rejected: edit and resubmit, request review, escalate to us. Screenshots: rejection notice in-app, the Fix It button, edit-and-resubmit flow. Related: compliance, quality score, Meta connect.

### 15. Setting your daily ad budget cap
- **Slug:** `daily-ad-budget-cap`
- **Category:** Ad accounts
- **Keyword:** "ad budget cap funnel ai"
- **Outline (~700 words):** Intro: the Cost Governor enforces a daily cap across all your campaigns. Default $50/day for Free, configurable on paid. Steps: workspace â†’ Billing â†’ Spend caps â†’ set daily cap. Screenshots: spend caps panel, the warning at 80%, the hard stop at 100%. Troubleshooting: "my ads stopped mid-day" (you hit your cap — expected), raising the cap, removing it (paid plans only). Related: billing plans, ad rejection, compliance agent.

### 16. Viewing and responding to leads
- **Slug:** `view-and-respond-leads`
- **Category:** CRM + Leads
- **Keyword:** "respond to leads funnel ai"
- **Outline (~800 words):** Intro: every form fill, click-to-call, and ad lead lands in your Leads inbox. Steps: open Leads, click a lead, see the timeline, reply via email or SMS in the right panel, set a stage tag. Screenshots: Leads inbox list, lead detail view, reply composer, stage picker. Troubleshooting: "I'm not getting leads" (publish status, ad status, pixel firing), "reply bounced" (verify sending domain), reply latency. Related: lead scoring, CRM export, RevTry.

### 17. Lead scoring explained
- **Slug:** `lead-scoring-explained`
- **Category:** CRM + Leads
- **Keyword:** "lead scoring funnel ai"
- **Outline (~900 words):** Intro: every lead gets a 0-100 score the moment it lands. Factors: fit signals (offer match, geo, declared budget if asked), engagement signals (time on page, scroll depth, click-to-call attempt, video view), source quality (organic vs paid vs RevTry-handoff). The five tiers and recommended action per tier. Screenshots: lead card showing score, the explainer popover, filter-by-score on inbox. Troubleshooting: "a clearly good lead got a low score" — what to check and how to give feedback. Related: viewing leads, RevTry, export.

### 18. Exporting your CRM data
- **Slug:** `exporting-crm-data`
- **Category:** CRM + Leads
- **Keyword:** "export leads csv funnel ai"
- **Outline (~600 words):** Intro: you own your data. Export anytime, no plan gate. Steps: Leads â†’ Export â†’ choose filters â†’ CSV or JSON â†’ download. Screenshots: export modal, file structure. Troubleshooting: large export emailed as link, GDPR export differs slightly (link to that article), webhook real-time alternative. Related: GDPR export, native CRM sync, viewing leads.

### 19. How RevTry calls leads (and how to customize the script)
- **Slug:** `revtry-how-it-calls`
- **Category:** RevTry voice
- **Keyword:** "revtry voice agent script"
- **Outline (~1,000 words):** Intro: RevTry is the voice agent that dials new high-intent leads within 90 seconds. Why speed-to-call matters. Steps: enable RevTry per funnel, choose voice, edit the opening line, set objection-handling presets, set escalation (handoff to your phone, voicemail drop, calendar booking). Screenshots: RevTry settings panel, voice picker, script editor with token highlighting. Troubleshooting: "RevTry isn't dialing" (time-of-day rules, opt-in source), "the voice sounds off," "the script said something I didn't write." Related: call recordings, RevTry minutes, compliance.

### 20. Listening to call recordings
- **Slug:** `revtry-call-recordings`
- **Category:** RevTry voice
- **Keyword:** "revtry call recording"
- **Outline (~500 words):** Intro: every RevTry call is recorded (where legal) and transcribed. Steps: Leads â†’ click lead â†’ Calls tab â†’ play. Screenshots: call entry on timeline, player, transcript view. Troubleshooting: "no recording" (two-party-consent state — we comply), retention window (90 days default), download. Related: RevTry script, compliance, lead scoring.

### 21. Out of RevTry minutes — upgrade or buy more
- **Slug:** `revtry-out-of-minutes`
- **Category:** RevTry voice
- **Keyword:** "revtry minutes refill"
- **Outline (~500 words):** Intro: minutes refill monthly with your plan; if you burn through them, here are your options. Steps: Billing â†’ RevTry Minutes â†’ buy add-on pack or upgrade. Screenshots: usage meter at 90%, add-on packs, plan upgrade prompt. Troubleshooting: "RevTry stopped dialing" (you're out — the safety stop is by design), rollover policy. Related: billing plans, upgrade plan.

### 22. Free tier vs Pro Boost vs paid plans
- **Slug:** `plans-comparison`
- **Category:** Billing & plans
- **Keyword:** "funnel ai pricing plans"
- **Outline (~700 words):** Intro: three things to know. Free = 1 funnel, subdomain only, light watermark, capped RevTry. Pro Boost = 7-day full-power trial (everything unlocked) on first sign-in. Paid plans = Starter, Growth, Scale. Comparison table. Screenshots: in-app plan comparison page. Troubleshooting: "my Pro Boost ended too fast" (it was 7 days, here's what you keep, here's what's gated). Related: upgrade, cancel, pause.

### 23. Upgrading or downgrading your plan
- **Slug:** `upgrade-downgrade-plan`
- **Category:** Billing & plans
- **Keyword:** "upgrade plan funnel ai"
- **Outline (~600 words):** Intro: change anytime, prorated. Steps: Billing â†’ Plan â†’ Change. Screenshots: change-plan modal, proration preview. Troubleshooting: downgrade feature loss preview (we show what you'll lose before you confirm), failed card, mid-cycle. Related: pause, plans comparison, cancel.

### 24. Pausing your subscription
- **Slug:** `pause-subscription`
- **Category:** Billing & plans
- **Keyword:** "pause funnel ai subscription"
- **Outline (~500 words):** Intro: keep your funnels live, freeze billing for up to 90 days. Steps: Billing â†’ Pause. Screenshots: pause confirmation, what stays on / what turns off. Troubleshooting: ads pause too (yes — your budget cap goes to $0), RevTry pauses too, unpause anytime. Related: cancel, upgrade.

### 25. Canceling and what happens to your funnels
- **Slug:** `cancel-subscription`
- **Category:** Billing & plans
- **Keyword:** "cancel funnel ai"
- **Outline (~700 words):** Intro: cancel anytime — no retention dark patterns. Here's exactly what happens to your stuff. Steps: Billing â†’ Cancel â†’ confirm. Timeline of what disconnects when: funnels stay live until billing-period end, then unpublish; custom domains release; data retained 30 days for re-activation, then deleted (unless GDPR-deleted sooner). Screenshots: cancel flow with timeline. Troubleshooting: "I want to keep one funnel free" (downgrade to Free instead), refund eligibility (link to refund policy), reactivation. Related: refund policy, pause, GDPR delete.

### 26. Enabling MFA
- **Slug:** `enable-mfa`
- **Category:** Account & security
- **Keyword:** "two factor authentication funnel ai"
- **Outline (~500 words):** Intro: turn on MFA in under a minute. We support TOTP (Authy, 1Password, Google Authenticator) and passkeys. Steps: Account â†’ Security â†’ Enable MFA â†’ scan QR or add passkey â†’ save recovery codes (store these). Screenshots: MFA panel, QR code state, recovery codes screen. Troubleshooting: lost device, recovery codes lost, organization SSO. Related: password reset, audit log.

### 27. Resetting your password
- **Slug:** `reset-password`
- **Category:** Account & security
- **Keyword:** "reset password funnel ai"
- **Outline (~400 words):** Intro: simple. Steps: sign-in page â†’ Forgot password â†’ email link â†’ set new. Screenshots: reset flow. Troubleshooting: email not arriving (spam, wrong address, SSO-only account), expired link, can't access email anymore. Related: MFA, contact support.

### 28. What is the AI disclosure footer (and can I remove it)?
- **Slug:** `ai-disclosure-footer`
- **Category:** Compliance & AI disclosure
- **Keyword:** "ai disclosure remove funnel"
- **Outline (~600 words):** Intro: every GoFunnelAI page ships with a small "Generated with GoFunnelAI" disclosure in the footer. Here's why, and what you can change. What it says, why it's there (trust, regulatory hedge, alignment with the AI Disclosure standard we publish under), what's customizable (wording within bounds, position within footer, color to match brand). What's not removable on which plans (Free = visible; Starter = visible; Growth = customizable; Scale = removable with a one-click acknowledgment that you take on disclosure responsibility per local law). Screenshots: footer in-page, customization panel. Troubleshooting: "regulators in my state require a different wording" (we have a localized library — link). Related: human review, GDPR, terms.

### 29. Why my funnel was flagged for human review
- **Slug:** `flagged-for-human-review`
- **Category:** Compliance & AI disclosure
- **Keyword:** "funnel held human review"
- **Outline (target 1,400 words — fully written in Part C):**
  Intro: ~3% of funnels get held by our reviewers before publish. It's a safety net, not a punishment. Why (regulated verticals, claim triggers, brand-new domain, repeat policy hits). What the reviewer actually does (the 4-point checklist). SLA: 4 business hours in US/EU windows, 24 hours otherwise. Appeals process. Screenshots: review status banner, the reviewer-note panel. Related: compliance, ad rejection.

### 30. GDPR data export and deletion walkthrough
- **Slug:** `gdpr-export-and-delete`
- **Category:** Compliance & AI disclosure
- **Keyword:** "gdpr export delete funnel ai"
- **Outline (~900 words):** Intro: under GDPR (and similar laws — CCPA, LGPD, PIPEDA), you can ask us for everything we hold on you, and we'll delete it on request. Steps for you (the workspace owner): Account â†’ Privacy â†’ Export everything (zipped JSON + CSV inside 24 hours), or Delete account. Steps for handling end-user requests (your leads): Privacy â†’ Lead requests â†’ enter email â†’ we surface every record across leads, calls, ads. Screenshots: privacy panel, export progress, lead-request lookup. Troubleshooting: data we're legally required to retain (billing — 7 years; tax — per jurisdiction), partial deletion, audit trail of deletions. Related: privacy policy, cancel, DPA download.

---

## PART C — Five Fully Written Articles

These are the highest-traffic-predicted articles. They model the voice and structure for everything that ships after.

---

### C1. Create your first funnel in 60 seconds

**Meta title:** Create your first funnel in 60 seconds — GoFunnelAI Help
**Meta description:** From a blank canvas to a live, generated, ready-to-publish funnel in under a minute. Here's the exact flow, plus what to do if anything sticks.
**Schema:** HowTo
**Category:** Getting started

---

# Create your first funnel in 60 seconds

If this is your first time inside GoFunnelAI, your first funnel is the fastest thing you'll do all week. We mean it — 60 seconds, no design background, no copywriting chops required. The agents handle the heavy lifting. You handle the brief.

This walkthrough takes you from a blank workspace to a generated, previewable funnel ready to publish.

## Before you start

You need exactly one thing: a one-sentence description of your offer. Examples that work:

- "$199 home solar consultation for homeowners in Texas"
- "Online sleep coaching for parents of toddlers, 4-week program, $399"
- "B2B SaaS demo signups for our supply-chain analytics tool"

If you can say that out loud, you're ready.

## Step 1 — Open New Funnel

From your workspace home, click the big **New Funnel** button in the top right.

[SCREENSHOT: Workspace home with the "New Funnel" button highlighted in the top-right corner.]

If you've just signed up, you'll see this button on your empty-state dashboard with a small arrow pointing to it. We don't make you hunt.

## Step 2 — Describe your offer

In the brief field, type your one-sentence offer description. The more specific you are, the better the first generation will be. Don't agonize — you can regenerate and edit freely.

**Pro tip:** Including a price, a target audience, and a geography (if relevant) gives the agents three strong signals to work with. "$199 home solar consultation for homeowners in Texas" beats "solar leads" every time.

[SCREENSHOT: New Funnel modal with the brief field, a placeholder example, and the "Generate" button.]

You'll also see three optional toggles:

- **Add a logo** — upload a PNG or SVG. We'll use it in the header and pull a color from it.
- **Pick a voice persona** — Funnel (default), Maven, Coach, Rebel, or Maestro. If you skip, we use Funnel.
- **Vertical hint** — if you're in a regulated category (health, finance, legal), pick it. Our Compliance agent will tune accordingly.

You can change all of these later, so don't overthink them now.

## Step 3 — Hit Generate

Click **Generate**. You'll watch the agent stack run in real time, each one announcing itself as it works:

1. Research agent — pulls baseline knowledge for your vertical.
2. Strategy agent — picks the funnel structure (one page or multi-step).
3. Copy agent — writes hero, body, CTAs.
4. Design agent — applies layout, your colors, your logo.
5. Compliance agent — pre-flights the claims and the disclosure footer.
6. Quality agent — scores the result. If under 80, it loops back automatically.

The whole thing usually finishes in 30 to 50 seconds. The "60" in the title is your conservative estimate.

[SCREENSHOT: Generation progress view showing the six agents as a vertical stack, each with a checkmark or active spinner.]

## Step 4 — Preview

The moment the Quality agent scores 80+, your preview opens. Scroll. Click around. Resize your browser to check mobile. Notice the score in the top-right of the preview chrome — that's your quality score (see *What is the quality score and how is it calculated?* for the math).

[SCREENSHOT: Preview view with the funnel rendered in a device frame, score pill in the top-right, and an "Edit," "Regenerate," and "Publish" button row across the top.]

If something looks off, you have three moves:

- **Edit inline** — click any text and type. Click any image to swap.
- **Regenerate a section** — hover the section, click the sparkle icon, give an instruction ("make this hero punchier").
- **Regenerate the whole thing** — top toolbar, Regenerate. New seed, fresh attempt.

## Step 5 — Publish

When you're happy, click **Publish**. You'll be asked to pick:

- **A free subdomain** (`yourname.funnel.app`) — instant, no setup.
- **A custom domain** — paste, we'll show you the CNAME, you set it on your DNS host. See *Connect your custom domain*.

You'll also see the **Publish Acknowledgment** — a one-screen confirmation that you've reviewed the content and the disclosure footer. Tick it, click Publish, you're live.

[SCREENSHOT: Publish modal with the two domain options and the acknowledgment checkbox.]

## Troubleshooting

**The generation got stuck at 99%.**
Refresh the page. If the funnel shows up in your dashboard, it finished — the progress bar just lost the handshake. If it's not there after a refresh, the generation failed silently; try again with the same brief.

**The preview is blank.**
Hard-refresh (Cmd/Ctrl + Shift + R). If still blank, your browser may be blocking our preview iframe — try a different browser. As a last resort, click **Open in new tab** above the preview.

**It generated, but it's not what I had in mind.**
That's normal on the first pass. Two options: regenerate the whole funnel with a tighter brief, or use section-level regeneration on the blocks you don't like. The latter is usually faster.

**My logo came out tiny / huge / pixelated.**
SVG is best. PNG at 1024Ã—1024 or larger is good. If neither is possible, upload what you have and adjust size in the brand panel under workspace settings.

## Related articles

- *Connect your custom domain*
- *Switching voice personas (Funnel, Maven, Coach, Rebel, Maestro)*
- *What is the quality score and how is it calculated?*
- *Editing your funnel without rebuilding from scratch*

---

**Still stuck?** Tap the chat bubble in the bottom-right of the app, or email **support@gofunnelai.com**. We answer fast.

---

### C2. Connecting your Meta Ads account

**Meta title:** Connect your Meta Ads account to GoFunnelAI (with fixes for every common error)
**Meta description:** A walkthrough of the Meta OAuth flow, the permissions we ask for, the data we access (and don't), and how to fix the four most common connection errors.
**Schema:** HowTo
**Category:** Ad accounts

---

# Connecting your Meta Ads account

Connecting your Meta Ads account unlocks one-click ad creation, lead attribution via your pixel, and the Compliance agent's pre-flight against Meta's ad policies. The whole connection takes about two minutes — most of which is Meta's OAuth screens, not ours.

This article walks you through the flow, lists exactly what we access (and what we don't), and gives you the fix for the four errors we see most often.

## Before you start

You need:

1. **Admin access** on the Meta Business Manager that owns the ad account you want to connect. If you're not an admin, you'll see Meta's "you don't have permission" page near the end of the flow — get added as an admin first.
2. **An active ad account** in that Business Manager. Inactive ones don't appear in the dropdown.
3. **A pixel** on that ad account, ideally already installed somewhere. If you don't have one, we can create one mid-flow.

If you don't have a Business Manager at all yet, go set one up at business.facebook.com first — it's free, takes about three minutes.

## Step 1 — Open the Meta integration

In your workspace, go to **Integrations** in the left rail, then click the **Meta** tile.

[SCREENSHOT: Integrations page with the Meta (Facebook + Instagram) tile, plus tiles for Google Ads, TikTok Ads, LinkedIn Ads.]

Click **Connect**. A new window opens with the Meta OAuth screen.

## Step 2 — Sign in to Meta

If you're already signed in to Facebook in this browser, you'll skip the password step. If not, sign in with the account that has access to the right Business Manager.

**Important:** sign in with your *personal* Facebook account, not a Business Manager email. Meta's OAuth runs through personal accounts even for business actions.

[SCREENSHOT: Meta OAuth permission screen showing "GoFunnelAI is requesting access to..." with the list of scopes.]

## Step 3 — Select Business Manager

Meta will show every Business Manager your personal account has access to. Pick the one that owns the ad account you want.

If the right one isn't in the list, your personal account isn't a member of it. Have the BM admin add you as a Marketer or Admin, then restart the connect flow.

## Step 4 — Select ad account and pixel

Back inside GoFunnelAI, you'll see two dropdowns:

- **Ad account** — pick the account you want us to manage spend through.
- **Pixel** — pick the pixel you want us to fire lead and conversion events on.

[SCREENSHOT: GoFunnelAI's post-OAuth selector with the ad account and pixel dropdowns, plus a "Create new pixel" link.]

If you don't have a pixel, click **Create new pixel** — we'll create one named after your workspace and auto-install it on every funnel you publish from here on out.

Click **Finish**. You'll land on the success state with a green "Connected" badge and the ad account ID visible. You're done.

## What we access vs. what we don't

| We access | We don't access |
|---|---|
| Your ad account ID and name | Your personal profile, friends, photos |
| The pixel you selected (read + write events) | Other pixels on other ad accounts |
| Ability to create + manage campaigns we launch | Campaigns you create directly in Ads Manager |
| Spend, impression, click, and conversion data for our campaigns | Your messages, page DMs, comments |
| Audience IDs we create | Custom audiences you built elsewhere (unless you grant per audience) |
| Read access to ad account currency, timezone, billing setup | Your payment method details |

We hold an OAuth token, not your password. Revoke us anytime from Meta's Business Settings â†’ Integrations â†’ GoFunnelAI â†’ Remove.

## Common errors and fixes

### "I don't see my ad account in the dropdown."

Three possible causes, ranked by likelihood:

1. **It's in a different Business Manager.** The dropdown only shows ad accounts inside the BM you picked in Step 3. Click back and pick a different BM.
2. **Your personal account isn't on the ad account.** Even if you're on the Business Manager, you also need to be on the specific ad account. Ask an admin to add you in BM â†’ Ad Accounts â†’ People.
3. **The ad account is on cooldown or suspended.** Meta hides suspended accounts from third-party integrations. Resolve the suspension first, then re-connect.

### "Pixel mismatch — the funnel says one pixel ID, but I see a different one in Events Manager."

Almost always one of two things:

1. **You picked the wrong pixel in Step 4.** Disconnect and reconnect; choose carefully. We default to the most recently active pixel, which isn't always the right one.
2. **You have a hardcoded pixel snippet in your domain settings or via Google Tag Manager** that's firing alongside ours. Find it, remove it, or merge it into the pixel we selected.

### "Permission denied at the OAuth screen."

You're not an admin on the Business Manager. Have someone who is open BM â†’ Business Settings â†’ People â†’ Add People â†’ enter your email â†’ assign Admin. Restart the flow.

### "Connection succeeded but my ad got rejected immediately."

Connection is unrelated to ad approval. See *Why was my ad rejected (and how to fix it)?* for the policy walkthrough. Short version: it's almost always claim language, not a connection problem.

### "I connected two Business Managers and now I'm seeing the wrong ad account by default."

In GoFunnelAI, go to Integrations â†’ Meta â†’ manage. You'll see both connections and can set one as the default. The default is what new funnels use unless you override per funnel.

## Disconnecting

Workspace â†’ Integrations â†’ Meta â†’ **Disconnect**. We immediately revoke the token on our side and stop pushing or reading data. Meta typically reflects the disconnection within a minute.

Disconnecting doesn't delete campaigns we already launched — those continue to run inside Meta until you pause them.

## Related articles

- *Connecting Google Ads*
- *Why was my ad rejected (and how to fix it)?*
- *Setting your daily ad budget cap*
- *Connect your custom domain*

---

**Still stuck?** Open chat in the bottom-right or email **support@gofunnelai.com** with your workspace ID and a screenshot of the error. Don't include your Meta password — we never need it.

---

### C3. Why was my ad rejected (and how to fix it)?

**Meta title:** Why was my ad rejected? A Meta + Google policy crash course, with fixes
**Meta description:** Ad rejections are normal and fixable. Here's the policy framework Meta and Google use, the eight most common reasons ads get rejected, and the three moves to recover.
**Schema:** FAQ
**Category:** Ad accounts

---

# Why was my ad rejected (and how to fix it)?

Ad rejections happen to everyone, including the agencies spending seven figures a month. They're not a black mark on your account, they're not personal, and ~95% of them are fixable in under five minutes. The trick is knowing *why* the rejection happened, which Meta and Google are notoriously bad at telling you in plain English.

This article gives you the policy framework, the eight reasons that account for roughly 85% of all rejections, what our Compliance agent does to prevent them in the first place, and the three moves you have when one still gets through.

## The 30-second policy crash course

Both Meta and Google review every ad — usually with machine review in seconds, sometimes with human review on top — against their advertising policies. Those policies cover a lot, but at launch you can hold the whole framework in three buckets:

1. **What you can sell.** Most things, with caveats. Categories like firearms, prescription drugs, financial products, gambling, tobacco, and cannabis are either banned, restricted to certified advertisers, or geo-fenced.
2. **What you can claim.** No guarantees of outcome ("make $10k a month — guaranteed"), no before/after weight-loss imagery, no targeting personal attributes ("are you depressed?"), no implying you know something about the viewer.
3. **What you can show.** No shocking, sexualized, or graphic imagery. No screenshots of competitor brands without rights. No misleading thumbnails or "shocked face" engagement bait (Meta) or excessive capitalization / punctuation (Google).

There are sub-policies under each, but if you stay clean on these three you'll avoid most rejection drama.

## The eight reasons we see most often

Across our customer base, these account for roughly 85% of all rejections:

1. **Personal-attribute targeting language.** "Are you over 50 and tired?" "Single moms in Dallas — this is for you." Meta's policy reads any second-person reference to a protected category as targeting that category, which is restricted.
2. **Unrealistic or unsubstantiated outcome claims.** "Lose 20 pounds in 30 days." "Make $5k a week from your couch." Both platforms reject these on sight.
3. **Before/after imagery (especially body, finance, skin).** Even when the result is real, the visual format itself is restricted.
4. **Trademark or brand impersonation.** Using "Shark Tank" without authorization. Using a public figure's name or face in a way that implies endorsement. Using a logo you don't own.
5. **Misleading clickbait.** "You won't believe what happened next." "One weird trick." Headlines that imply the click reveals a secret are rejected for sensationalism.
6. **Restricted-category claims without disclaimer.** Financial: "Guaranteed returns." Health: "Cure for [condition]." These categories require disclaimers or full disqualify on certain claims regardless of disclaimer.
7. **Landing-page mismatch.** The ad promises X, the landing page delivers Y. Common with bait-and-switch headlines.
8. **Low-quality or broken creative.** Pixelated images, broken auto-translation, landing page returning 404 or slow-load failures.

## How our Compliance agent helps prevent this

Every funnel and every ad you launch through GoFunnelAI runs through the Compliance agent before it ever reaches Meta or Google. The agent does three things:

1. **Policy pre-flight.** It checks your copy against a living rule set mirrored from Meta's Advertising Standards and Google's Ads Policies. If you have wording that's a known-rejection trigger, it flags it and offers a rewrite that keeps your intent but trades the risky phrase.
2. **Claim audit.** Any quantified outcome ("20 pounds in 30 days," "$5k/week") is flagged for substantiation. If you can't provide a citation, we soften the claim or drop it.
3. **Vertical-aware checks.** If your funnel is in a regulated category (health, finance, legal, gambling, cannabis, alcohol, dating, real estate), additional rule packs activate. You can read the full list in our Trust & Safety policy.

The pre-flight isn't a guarantee — Meta and Google make their own calls, and they update their rules constantly — but it cuts our customers' rejection rate by roughly 70% versus what we see for the same offers run by hand elsewhere.

## What to do when an ad still gets rejected

You have three moves, in order of preference.

### Move 1 — Edit and resubmit

In the GoFunnelAI Ads view, the rejected ad shows a red **Rejected** badge with Meta or Google's reason next to it. Click **Fix it**. Our Compliance agent reads the rejection reason and the original creative, and proposes a rewrite that addresses the specific flag.

[SCREENSHOT: Rejected ad in the Ads view, with the rejection reason from Meta visible and the "Fix it" button prominent.]

Click **Apply suggestion**, review the new version, click **Resubmit**. Meta and Google review the new version separately — there's no penalty for a resubmission, and the second-attempt approval rate runs around 80% in our data.

### Move 2 — Request review (when you believe the rejection is wrong)

Sometimes Meta or Google misreads an ad — a perfectly innocuous phrase trips a classifier. Both platforms offer a "Request review" path. In the rejected-ad view, click **Request platform review**. We send the request on your behalf, with a brief explanation auto-drafted from the rejection reason.

Reviews take 24-72 hours on Meta, 1-3 business days on Google. About a quarter of requested reviews end in reversal. The rest get a "decision upheld" — at which point go back to Move 1 and edit.

### Move 3 — Escalate to us

If the same ad gets rejected twice with conflicting reasons, or if your whole ad account got disabled (not just one ad), escalate to us. Open chat, attach the funnel ID and the rejected-ad ID, and we'll take a look. We have Meta and Google partner channels for account-level issues we can sometimes pull on.

A note on disabled ad accounts: those are usually a sign Meta or Google flagged your *whole* account, not just one ad. Sometimes that's a real policy issue, sometimes it's a false positive on a new account. Either way, the appeal goes through their support, not ours — we can guide you, but only you can submit it.

## Common rejection-reason translations

Here's what some of Meta's vague rejection messages actually mean, in plain English:

| What Meta says | What it actually means |
|---|---|
| "Personal attributes" | You wrote "you" + a category (age, condition, identity). Reword to "this is for people who..." or third-person. |
| "Unacceptable business practice" | A claim or offer triggered a fraud-pattern classifier. Often a guarantee or get-rich-quick framing. |
| "Circumventing systems" | Usually a URL shortener, a redirect chain, or text-in-image that the classifier read as a workaround. |
| "Adult content" | Could be a swimsuit photo. Could be the word "naked" in a marketing sense. Often a false positive — Move 2. |
| "Misinformation" | A health, finance, or election claim that doesn't match a vetted source. Add a citation or soften the claim. |

## Related articles

- *Connecting your Meta Ads account*
- *What is the quality score and how is it calculated?*
- *Why my funnel was flagged for human review*
- *Setting your daily ad budget cap*

---

**Still stuck?** Open chat in-app with your ad ID, or email **support@gofunnelai.com**. We've seen most rejections more than once.

---

### C4. What is the quality score and how is it calculated?

**Meta title:** The GoFunnelAI quality score, explained — all nine sub-scores
**Meta description:** Every funnel ships with a 0-100 quality score. Here's exactly what goes into it, why we auto-regenerate below 80, and how to read your score-card.
**Schema:** Article
**Category:** Generating funnels

---

# What is the quality score and how is it calculated?

Every funnel you generate inside GoFunnelAI gets a quality score from 0 to 100. You can see it in the top-right of the preview view, in the funnel list on your dashboard, and on every screenshot in this Help Center. It's the single most important number we surface about your funnel, because it determines whether we ship it as-is, regenerate it automatically, or hold it for review.

This article opens the hood. You'll see the nine sub-scores that roll up into the headline number, how each one is measured, why we set the auto-regenerate threshold at 80, and how to act on a score you don't like.

## The headline number

The quality score is a weighted average of nine sub-scores. Each sub-score is itself a 0-100 number computed by a mix of model evaluation and deterministic heuristics. The weights aren't equal — some components matter more than others (we'll get to which).

We compute the score after every generation and after every regeneration, on both the desktop and the mobile rendering of your funnel. The lower of the two is what you see, because a funnel that scores 90 on desktop and 60 on mobile is functionally a 60.

## The nine sub-scores

### 1. Offer clarity (weight: 18%)

**What it measures:** Can a stranger, in three seconds, tell what you're selling, who it's for, and what they get?

**How we measure it:** A vision-and-text model reads the hero section the way a real visitor would — fast, top-to-bottom. It scores three things: is the *what* explicit (product, service, outcome), is the *who* implied or stated (audience), is the *what's-in-it-for-them* present (concrete benefit, not abstract feature). Bonus points for a price or a guarantee being visible without scrolling.

**Why it's the heaviest weight:** Clarity is the conversion ceiling. The best design can't save a hero that leaves visitors guessing.

### 2. Headline strength (weight: 14%)

**What it measures:** Does the hero headline pull? Does it make a specific promise, surface a tension, or land a concrete benefit?

**How we measure it:** A copy-evaluation model rates against patterns from a corpus of high-converting headlines in the same vertical, scored on four dimensions: specificity, benefit-density, freshness (vs. clichÃ©), and length appropriateness (too long is a penalty; too short can be too).

### 3. Social proof density (weight: 12%)

**What it measures:** Is there proof — testimonials, logos, case studies, numbers, badges — and is it placed where it does work (near the CTAs, not at the bottom)?

**How we measure it:** Count of proof elements, weighted by type (a named-customer case study weighs more than a star rating) and position (above the first CTA weighs more than below it).

### 4. CTA hierarchy (weight: 11%)

**What it measures:** Is there one clear primary action, repeated thoughtfully, with no competing buttons?

**How we measure it:** We count CTAs, classify each as primary or secondary by visual prominence (size, color contrast, positioning), and check that the primary action is consistent. A page with three "Buy now" buttons of three different colors loses points; a page with one strong primary repeated three times scores well.

### 5. Mobile rendering (weight: 12%)

**What it measures:** Does the funnel work on a phone? Not "look fine" — *work*. Tap targets, readable text, no horizontal scroll, no overlap, no slow LCP.

**How we measure it:** A headless mobile-Chrome render evaluates against the Core Web Vitals (LCP, CLS, INP), plus a tap-target audit, plus a font-size minimum check.

**Why it's weighted high:** 65%+ of funnel traffic in our data is mobile. A desktop-only-passable funnel is a half-built funnel.

### 6. Accessibility (weight: 8%)

**What it measures:** Alt text on images, semantic heading hierarchy, color contrast meeting WCAG AA, form labels, focus order.

**How we measure it:** A combination of axe-core rule checks and a model audit for things axe can't see (e.g., "this animation could trigger motion sensitivity — is there a reduce-motion fallback?").

### 7. Brand consistency (weight: 8%)

**What it measures:** Does the funnel feel like your brand? Are your colors, your logo, your fonts, your voice persona applied consistently?

**How we measure it:** Compare against your workspace's Brand profile. Color delta, font-family match, logo presence and sizing, and a copy-voice classifier checking the funnel against your selected persona.

### 8. Compliance safety (weight: 10%)

**What it measures:** Is the funnel safe to publish — both for our policies and for the platforms (Meta, Google) you'll likely advertise on?

**How we measure it:** The Compliance agent's rule pack runs over the funnel and counts soft and hard flags. Hard flags (banned-category claim without certification) drop this sub-score sharply and route the funnel to human review (see *Why my funnel was flagged for human review*).

### 9. Technical performance (weight: 7%)

**What it measures:** Page weight, time to interactive, request count, image optimization.

**How we measure it:** Lighthouse performance score plus our own image-budget audit. Funnels with a 4 MB hero image score lower than the same funnel with a 200 KB hero image.

## Why the auto-regenerate threshold is 80

We set 80 as the line because it's where our data shows the conversion curve flattens. Funnels at 80+ perform roughly equivalently to funnels at 95+ in real-world A/B tests — the marginal points above 80 don't move the conversion needle reliably. Below 80, performance drops sharply, so it's worth another generation pass.

When the Quality agent scores a freshly generated funnel below 80, it doesn't show you the funnel and ask "want to regenerate?" — it just loops. The Quality agent passes the score-card back to the Strategy and Copy agents, they take another shot, and we score again. The loop has a hard cap of three iterations to keep cost bounded. If after three loops we're still below 80, the funnel gets flagged for review and a human looks at it before you see anything.

## How to read your score-card

In the preview view, click the score pill in the top-right. The score-card panel slides out and shows all nine sub-scores with a one-line explanation each.

[SCREENSHOT: Score-card panel with nine rows, each showing the sub-score name, the numerical score, a color-coded bar, and a one-line "what would move this" tip.]

For any sub-score that's pulling the headline down, the panel includes a one-click action. "Mobile rendering: 64. Action: tap-targets are too small in your testimonials section — regenerate that section."

## What if I disagree with the score?

Two things you can do:

1. **Override on publish.** You can publish below 80 by clicking the "Publish anyway" link on the publish modal. It requires typing "publish anyway" — we make you mean it. Your conversion results are your own.
2. **Flag the score as wrong.** In the score-card, click "Disagree." Tell us what you think the score should be and why. This goes to our model team and is used to retrain the evaluators. It's the single highest-signal feedback we get.

## Common questions

**"My score won't budge above 78."**
Usually one sub-score is dragging it down disproportionately. Open the score-card and look for the lowest number — it's almost always either mobile rendering (compress images, increase font size) or compliance safety (soften a claim). Fix that one and re-score.

**"A nearly identical funnel got 90 yesterday and 75 today."**
The evaluator models update on a regular cadence. We notify in-app when an evaluator change shifts scores meaningfully. If the gap is unexplained, flag it as disagreement — we look at every flagged delta.

**"Do you regenerate the whole funnel or just the parts that scored low?"**
Targeted. The Quality agent tells the Strategy and Copy agents *which* sub-scores need work, and only those parts get regenerated. We don't redo what was already strong.

## Related articles

- *How to regenerate a section of your funnel*
- *Editing your funnel without rebuilding from scratch*
- *Why my funnel was flagged for human review*
- *Switching voice personas*

---

**Still stuck?** Open chat in-app. If you think the score is off, flag it from the score-card itself — that's the fastest path to a real engineer reading it.

---

### C5. Why my funnel was flagged for human review

**Meta title:** Why was my funnel held for review? — GoFunnelAI Help
**Meta description:** About 3% of funnels get held by our human reviewers before publish. Here's why it happens, what the reviewer checks, our SLA, and how to appeal.
**Schema:** FAQ
**Category:** Compliance & AI disclosure

---

# Why my funnel was flagged for human review

Roughly 3% of funnels generated inside GoFunnelAI get held by our human reviewers before they're allowed to publish. If yours is one of them, you'll see a banner at the top of your funnel view that says **In review** with a status pill, and the **Publish** button will be temporarily disabled.

We get it — having a human "approve" your work feels like friction, especially when you're trying to launch. This article exists to make the experience as transparent as possible: why we hold, what the reviewer actually does, how long it takes, and how to appeal a decision you disagree with.

## Why funnels get held

Funnels get routed to human review for one of four reasons. The banner tells you which.

### Reason 1 — Regulated vertical

Certain industries are held for review on first publish, every publish, depending on the category:

- **Health, medical, supplements, weight-loss** — every publish.
- **Finance, lending, investing, crypto** — every publish.
- **Legal services** — every publish.
- **Gambling, betting, sports-pick services** — every publish, plus geo-restriction check.
- **Cannabis, kratom, alcohol** — every publish, plus geo-restriction check.
- **Dating** — first three publishes per workspace, then random sampling.
- **Real estate, mortgage** — first publish per workspace, then random sampling.
- **Multi-level marketing** — every publish.

This isn't us deciding you can't run these offers. It's us making sure the funnel is compliant with the rules that apply to your category — many of which are state, country, and platform-specific, and many of which a model alone can't perfectly catch.

### Reason 2 — Claim trigger

The Compliance agent flagged a specific phrase as a potential policy issue and routed it to a human for a second opinion. Common triggers:

- Quantified outcome claims that lack a citation ("save $5,000 a year," "lose 30 pounds")
- Guarantee language without clear refund terms
- Comparison claims against named competitors
- Endorsement language that implies a celebrity or government endorsement
- "FDA-approved," "scientifically proven," or similar regulatory-suggestive phrasing

You'll see exactly which phrase triggered the hold in the reviewer-note panel.

### Reason 3 — Brand-new domain

Funnels on a domain that's less than 30 days old get a one-time review the first time you publish on that domain. This is a fraud-prevention check, not a content check. New domains are over-represented in scam patterns across the ad ecosystem, and reviewing the first publish helps protect everyone.

After one approved publish, the domain is trusted and future publishes skip this check (other reasons can still trigger holds).

### Reason 4 — Repeat policy hits in your workspace

If your workspace has had two or more compliance flags in the last 30 days, new funnels get a standard review pass even if individual checks pass. This is not punitive — think of it as elevated diligence after a pattern. After 30 days without flags, this elevated state automatically clears.

## What the reviewer actually does

Every reviewer follows a four-point checklist. It's the same checklist for every review, regardless of vertical.

1. **Read the funnel front-to-back as a visitor would.** Does it deliver what it promises? Are there hidden, materially different terms (a "free" offer that's actually a $200/month subscription buried in fine print)?
2. **Pull every quantified claim and check it for substantiation.** If the funnel says "average customer saves $1,200/year," the reviewer looks for a source — either from the source library you've uploaded to your workspace, or from a public citation embedded in the page.
3. **Match the funnel to the vertical rule pack.** For health: are FDA/FTC restrictions respected? For finance: are required disclosures present? For legal: is there bar-required language for your state? The rule packs are maintained by our compliance team and updated when regulators change rules.
4. **Spot-check the disclosure footer and the data-handling.** The AI disclosure footer is present and worded correctly for the funnel's geography. The privacy and terms links resolve. Form data goes where the page says it goes.

The reviewer can approve, approve with a small required edit (we apply the edit and approve), or reject with notes.

## SLA: how long this takes

- **US business hours (9 AM - 6 PM ET, Mon-Fri):** 4 hours, p95.
- **EU business hours (9 AM - 6 PM CET, Mon-Fri):** 4 hours, p95.
- **All other times:** 24 hours, p95.

We staff to those SLAs and miss them less than 2% of the time. If your funnel has been in review longer than the relevant SLA, open chat and we'll escalate.

You'll get an email and an in-app notification the moment the review completes, with a one-line summary of the outcome. If the funnel was approved, the **Publish** button re-enables. If it was approved with a required edit, the edit is already applied and you can review it before publishing. If it was rejected, you'll see reviewer notes with specifics.

## What the reviewer does *not* do

To be precise about what review is not:

- It's not a *quality* review. The reviewer is not judging whether your headline is catchy. The Quality agent already did that (see *What is the quality score and how is it calculated?*).
- It's not a *strategy* review. The reviewer doesn't tell you whether your offer is good or your pricing is right.
- It's not a *taste* review. We won't reject a funnel because the reviewer would have used a different color.
- It's not *gating*. We don't hold funnels to upsell you a plan. Reviews are free on every paid plan and on Pro Boost.

## Appeals

If your funnel is rejected and you disagree, you have an appeal:

1. In the rejection notice, click **Appeal**.
2. Write a brief reason — what specifically you disagree with, and why. Attach a citation if your appeal is about substantiation.
3. The appeal goes to a senior reviewer who didn't see the first pass. They re-review independently against the same four-point checklist.

Appeals are resolved within 1 business day. About 35% of appeals end in reversal — most of those are situations where the citation existed but wasn't surfaced clearly to the first reviewer, or the rule was misapplied. We track every appeal and every reversal as training data for the reviewer team.

## Common questions

**"My funnel was held — does this mean I'm in trouble?"**
No. Holds are routine for the categories and triggers listed above. They're not a record against your account.

**"Can I bypass review for a non-regulated funnel that got caught on a single phrase?"**
Edit the phrase and re-submit. The Compliance agent will re-check; if the trigger is gone, the funnel doesn't go to human review at all.

**"I'm in a regulated vertical — am I going to be held forever?"**
Yes, for the categories that say "every publish." Those exist because the rules in those verticals change too fast and vary too much for an automated check alone. We're not changing that policy. We *have* gotten the SLA tight enough that most customers tell us they barely notice it.

**"Will reviewers see my proprietary information?"**
Reviewers see what's on the funnel — the same thing any visitor would see — plus your workspace's Brand profile and any source library entries you've made public to reviewers. They do not see your CRM data, your lead lists, your billing, or your private documents.

## Related articles

- *Why was my ad rejected (and how to fix it)?*
- *What is the AI disclosure footer (and can I remove it)?*
- *What is the quality score and how is it calculated?*
- *GDPR data export and deletion walkthrough*

---

**Still stuck?** Open chat with your funnel ID. If your funnel has been in review past the SLA above, mention "past SLA" and you'll be escalated.

---

## PART D — Search Optimization

### D1. Meta titles and descriptions

Every published article ships with a unique **meta title** (under 60 characters) and **meta description** (under 155 characters). Drafted by the writer, validated by Content Ops on review. Examples above on the five fully-written pieces.

For the remaining 25 launch articles, defaults are pre-generated from a template and then human-reviewed before publish:

- **Title template:** `{Article H1} — GoFunnelAI Help`
- **Description template:** First sentence of the intro paragraph, rewritten to be under 155 characters and to surface the target keyword once.

### D2. Schema.org markup

| Schema type | When to use | Examples from our 30 |
|---|---|---|
| `HowTo` | Step-by-step articles with a clear ordered procedure | Create first funnel, Connect Meta, CNAME setup, Enable MFA |
| `FAQ` | Articles that answer a specific question and may bundle related Q&As | Ad rejected, Human review, AI disclosure removable? |
| `Article` | Conceptual / explainer pieces without a procedure | Quality score, Lead scoring, Persona comparison |

Each article's metadata file declares `schema_type`, which the static-site generator uses to inject the right JSON-LD on render. HowTo schema includes step-by-step blocks pulled from the article's H2/H3 structure. FAQ schema pulls Q&A pairs from any H3 phrased as a question.

### D3. Sitemap structure

`help.gofunnelai.com/sitemap.xml` — auto-generated, regenerated on every publish, structured as:

```
/sitemap.xml
  â””â”€â”€ /sitemap-categories.xml      (10 category pages)
  â””â”€â”€ /sitemap-articles.xml        (every article)
  â””â”€â”€ /sitemap-search.xml          (search landing pages for high-volume keywords)
```

Each `<url>` entry includes `<lastmod>` from `last_updated`, `<changefreq>` (weekly for top-traffic, monthly for the long tail), and `<priority>` weighted by `predicted_traffic_tier`.

Submitted to Google Search Console and Bing Webmaster Tools on launch. Re-submitted programmatically on any sitemap change.

### D4. Indexing strategy

1. **All Help Center pages are indexable** — no `noindex` anywhere by default.
2. **Canonical tags** are self-referential on every article. Category pages canonical to themselves.
3. **Internal linking** is dense — every article has 3-5 related-article links in the related section, plus inline cross-links in the body where natural. This builds topical clusters that Google rewards.
4. **External linking** is used where it adds credibility — when we reference Meta's policies, we link to Meta's official policy page; when we reference WCAG, we link to W3C. We don't no-follow these.
5. **URL structure** is flat: `help.gofunnelai.com/{category-slug}/{article-slug}`. Two levels max.
6. **Image alt text** is required on every screenshot — accessibility *and* image search.
7. **404 handling** — any deprecated article 301-redirects to its replacement or to the parent category page. We never let a previously-indexed URL go to a 404.

---

## PART E — Plan to Scale to 100+ Articles by Month 3

### E1. Backlog topics (50 more, prioritized)

**Getting started — additional**
- Setting up your workspace brand profile
- Understanding the dashboard
- What to do in your first 24 hours
- Glossary of GoFunnelAI terms

**Generating — additional**
- Using the source library to ground claims
- Locking a section so AI never overwrites it
- A/B testing two versions of the same funnel
- Generating a multi-step (vs. single-page) funnel
- Cloning a funnel as a starting point
- Generating in a language other than English
- Translating an existing funnel
- Industry-specific tips: solar
- Industry-specific tips: coaching/info products
- Industry-specific tips: home services

**Publishing — additional**
- Setting custom meta title and description per funnel
- OG image preview customization
- Favicon upload
- Unpublishing a funnel
- Scheduled publish (publish at a future time)
- Maintenance mode
- Geo-redirects (sending visitors to country-specific funnels)

**Domains — additional**
- Apex / root domain setup (no www)
- Cloudflare proxy configuration
- Subdomain on a domain we don't own (delegation)
- Moving a domain off GoFunnelAI cleanly
- Domain verification states explained

**Ads — additional**
- Connecting TikTok Ads
- Connecting LinkedIn Ads
- One-click ad creation from a published funnel
- UTM strategy and our auto-tagging
- Custom audience syncing
- Conversion event mapping
- Catalog feeds (Meta)
- Performance dashboards

**CRM + Leads — additional**
- Auto-replying to leads
- Forwarding leads to your existing CRM (HubSpot, Salesforce, Pipedrive, GoHighLevel)
- Webhooks for new lead events
- Zapier and Make recipes
- Tagging and segmentation
- Duplicate lead detection
- Lead enrichment (what we look up and what's optional)

**RevTry — additional**
- Setting time-of-day dialing rules
- Setting state-by-state compliance (TCPA, two-party consent)
- Voicemail drops
- Calendar handoff (Calendly, Cal.com, native)
- Hot-handoff to your phone
- Custom voice cloning policy
- RevTry analytics and metrics

**Billing — additional**
- Switching from monthly to annual
- Adding a billing contact / VAT ID
- Reading your invoice
- Failed payment recovery
- Switching the workspace owner

**Account & security — additional**
- SSO / SAML setup (enterprise)
- API tokens and management
- Audit log walkthrough
- Session management
- Removing a former team member fully

**Compliance — additional**
- DPA (Data Processing Agreement) — how to get one
- Sub-processor list and changes
- CCPA specifics
- Cookie banner customization
- Source library — uploading proof for claims

### E2. Content Ops process

**Cadence:** 6-8 new articles per week, sustainable.

**Roles:**
- **Writer (1 dedicated, plus rotating contributors from CS + Support):** Drafts to the article template with full metadata. Required: screenshots, related-article links, troubleshooting section, CTA.
- **Reviewer (Engineering + Product, rotating):** Reviews any article that touches a feature for technical accuracy. Required for HowTo articles, optional for Article-type pieces.
- **Editor (Content Ops lead):** Voice, structure, SEO, and final pass. Approves to publish.
- **Publisher (Content Ops lead or designate):** Hits publish, runs sitemap regeneration, runs internal-link audit.

**Weekly rhythm:**
- **Monday:** Triage. Editor reviews the Customer-question feed (see E3) plus zero-result-search log. Picks 8 topics for the week, assigns writers.
- **Tuesday-Thursday:** Drafting. Writers produce drafts. Screenshots captured against the latest UI build.
- **Friday morning:** Review. Engineering + Product reviewers turn around technical-accuracy checks within 24 hours.
- **Friday afternoon:** Edit + publish. Editor does the final pass; publisher ships.

**Templates:** Every article uses one of three templates (HowTo, FAQ, Article). Templates are pre-loaded in the CMS with the required sections — writers fill in, they can't accidentally skip the troubleshooting section.

**Definition of done:**
- Front-matter complete (every field in the schema above)
- Meta title + description filled in
- 3-5 related articles linked
- Screenshots captured against current UI (no stale UI permitted)
- Mobile preview reviewed
- Schema type set
- One CS team member who isn't the writer or editor has read it end-to-end
- Published to staging, smoke-tested, then promoted to production

### E3. Customer-question feed

The single biggest input to the Help Center backlog is the support inbox itself. Every support ticket is tagged at close with one of:

- **`hc-existing-article`** — the answer was already in an existing article. We attach the article to the ticket reply. This signals the article is useful and discoverable.
- **`hc-gap`** — there's no article for this question, or there is one but it's not discoverable. Auto-creates a backlog ticket in the Content Ops board with the customer's exact phrasing as the candidate target keyword.
- **`hc-bad-article`** — there *is* an article, but the customer found it and it didn't help. Higher priority than a gap because it indicates a broken article, not a missing one. Auto-routes to the article's reviewer for a fix sprint.
- **`product-bug`** — not a Help Center issue; routes to Engineering.

The Content Ops board reviews `hc-gap` tickets weekly. Any topic with 3+ tickets in a quarter automatically promotes to the upcoming week's backlog. Any topic with 1+ ticket gets added to the backlog with appropriate priority.

We also pipe in:
- **Zero-result search queries** from the in-product search log.
- **Onboarding drop-off points** from the activation funnel — wherever users get stuck and abandon, we look for whether there's an article that would unstick them, and write one if not.
- **NPS / CSAT comments** — searched monthly for "I couldn't figure out how to..." patterns.
- **Sales objection log** — common pre-sale questions become Help Center articles, which also serve as enablement.

### E4. Quality bar over time

We measure three things on every article, monthly:

1. **Search position** for the target keyword (Google Search Console). Target: top 5 within 90 days of publish.
2. **Ticket deflection** — change in volume of tickets tagged to that article's topic before vs. after publish. Target: 30% deflection on top-tier articles.
3. **Article CSAT** — the "Was this helpful?" widget at the bottom of every article. Target: 85% helpful.

Articles below threshold on any of the three are refactored, not archived. The refactor is a deliberate exercise — new screenshots, new examples, new troubleshooting cases sourced from the latest tickets.

### E5. Tooling

- **CMS:** Notion-as-source-of-truth + GitHub PR review for technical articles, rendered to a static site (Next.js + MDX).
- **Search:** Algolia DocSearch.
- **Analytics:** Plausible (lightweight) + Google Search Console.
- **Screenshot capture:** Per-environment automation that takes a baseline capture against a frozen staging build, so screenshots are reproducible.
- **Stale-content alerts:** A weekly job flags any article whose `last_updated` is more than 180 days old, where the related product feature has shipped a change since. Routes to the article's reviewer.

---

## Definition of "launched"

For Day 90 the Help Center is launched when:

- [x] IA shipped (10 categories, sub-categories live)
- [x] 30 launch articles published with full metadata
- [x] 5 fully-written tentpoles (this doc's Part C set) ship as published, not drafts
- [x] Search live with synonyms, typo tolerance, and zero-result analytics
- [x] Sitemap submitted to Google + Bing
- [x] Support ticket tagging schema in place
- [x] Content Ops weekly rhythm running with a writer + reviewer + editor + publisher named
- [x] First "what to write next month" planning meeting on the calendar

The Help Center is never "done." It's a living surface that ships weekly. This is the starter.
