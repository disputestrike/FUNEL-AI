# 13 â€” Agency Enablement Kit

> **Status:** Canonical. Ships with Day-90 launch of the Agency tier ($997/mo).
> **Owners:** Partnerships (program), Product (sub-accounts + fulfillment dashboard), Eng (sub-account architecture), Marketing (assets + certification), Support (agency SLA).
> **Audience:** Agency owners evaluating FunelAI, our partnerships team, the agency-facing eng/CS pods.
> **Companion docs:** `01-funnel-grader-build-spec.md`, `03-event-taxonomy-and-schemas.md`, `04-integration-matrix-and-pal.md`, `06a-customer-success-activation-framework.md`, `07a-trust-and-safety-policy.md`, `08-engineering-ops-spec.md`.

---

## Why this document exists

Agencies are the single biggest distribution channel for vertical-SaaS lead-gen platforms. GoHighLevel got to ~$200M ARR almost entirely on agency white-label, ClickFunnels built a billion-dollar brand off "funnel agencies," and Vendasta built its book of business one agency at a time. We are choosing to compete head-on, and we will win because:

1. **The product is built.** Our funnel-grader produces a working, on-brand, compliance-checked funnel in 60 seconds. Manual agencies cannot match this and don't want to try.
2. **Our COGS scales beautifully.** One $997/mo agency seat serves ~50 client sub-accounts, so the agency's effective gross margin is in the 70â€“90% range. That's the number that closes the deal.
3. **RevTry is a sword.** AI voice follow-up at sub-minute SLA is a differentiator no agency can replicate alone. Agencies sell this as "we 3x your lead-to-call rate" and it's true.

This kit is everything an agency owner needs to (a) decide to buy, (b) onboard their first clients, (c) get certified, and (d) scale to 50+ clients without us in the loop.

---

## Table of contents

- [Section 1 â€” Agency Sales Deck (15 slides)](#section-1--agency-sales-deck)
- [Section 2 â€” Client Onboarding Checklist (5 steps)](#section-2--client-onboarding-checklist)
- [Section 3 â€” Certification Course: "FunelAI for Agencies"](#section-3--certification-course-funnelai-for-agencies)
- [Section 4 â€” Sub-Account Architecture (Engineering Spec)](#section-4--sub-account-architecture-engineering-spec)
- [Section 5 â€” Fulfillment Dashboard (Product Spec)](#section-5--fulfillment-dashboard-product-spec)
- [Section 6 â€” Agency SLA Spec](#section-6--agency-sla-spec)
- [Section 7 â€” Marketing Assets for Agencies](#section-7--marketing-assets-for-agencies)
- [Section 8 â€” Agency Revenue Share Program](#section-8--agency-revenue-share-program)

---

## Section 1 â€” Agency Sales Deck

**Format:** 15 slides, ~25 minutes including live demo. Deck lives in Pitch (master file: `agency-deck-master`), exported to PDF + Keynote + Google Slides. Sales reps run this; we also publish a self-serve recorded version at `funelai.com/for-agencies/watch`.

**Deck-wide design rules:** dark navy background, one big number per slide, max 12 words of slide copy. Speaker notes do the heavy lifting. Slides 6 (demo) and 14 (certification) are the two emotional peaks â€” pacing should accelerate into 6 and slow into 15.

---

### Slide 1 â€” The opportunity: every local business needs lead gen; most agencies can't deliver

**On-slide content**
- Headline: "33 million local businesses in the US. 4 million pay an agency. Why so few?"
- Visual: a funnel-shaped chart, top = "businesses that need leads," bottom = "businesses an agency can profitably serve today."
- Footer stat: "The constraint isn't demand. It's fulfillment."

**Speaker notes**
Open with a question to the room: how many leads did your clients ask for last month, and how many did you deliver? Most agency owners will admit the gap is 2-5x. The reason isn't lack of clients â€” it's that one human-built funnel takes 40-80 hours and a strategist plus a copywriter plus a designer plus a paid-media buyer. So agencies cap their roster at 10-25 clients per FTE and turn away the rest. We're going to spend the next 25 minutes showing you how to serve 50 clients with the same headcount.

---

### Slide 2 â€” The old way is broken

**On-slide content**
- Three columns:
  - DIY (ClickFunnels, Leadpages, WordPress): "Client builds it themselves. 80% never launch."
  - Agency-manual (Webflow + Figma + custom copy): "60 hours per funnel. $5k-$15k build fee. Slow."
  - Hire-and-pray (in-house marketer): "$80k/yr, leaves in 18 months, takes the playbook."
- Footer: "The bottleneck is the human in the loop."

**Speaker notes**
Acknowledge their pain â€” every agency in the room has tried at least two of these. ClickFunnels works for the 1% of clients who'll do the work; for the other 99% it's shelfware. Manual agency builds have great margins on the build fee but terrible margins on retainers because you keep getting pulled into iteration. The in-house hire is the worst trap because it lets clients believe they don't need you. The unifying theme: a human is in the critical path of every funnel.

---

### Slide 3 â€” The new way: AI-generated funnels in 60 seconds per client

**On-slide content**
- Big number: "60 seconds."
- Sub-headline: "URL in. Full funnel out. On-brand, compliant, ready to publish."
- Three pillars below: "Generate. Publish. Convert." with one-line each.

**Speaker notes**
Tease the demo coming on slide 6. The 60-second number is real and we'll prove it live. What gets generated: landing page, lead-magnet flow, email sequence (5-7 emails), SMS sequence, voice script, and ad creative variants. All seeded from the client's existing site, brand colors pulled automatically, copy tuned to the vertical KB pack. The agency owner's job changes from "build funnels" to "approve funnels and scale ads" â€” a much higher-leverage role.

---

### Slide 4 â€” What you get with the Agency tier

**On-slide content**
- Header: "Agency tier â€” $997/mo"
- Six bullets, two columns:
  - Unlimited funnels across all sub-accounts
  - Up to 100 client sub-accounts (soft cap; we lift on request)
  - White-label domain (`clients.yourdomain.com`)
  - 5,000 RevTry minutes pooled across clients
  - Snapshot library (clone winning funnels)
  - Fulfillment dashboard + agency-tier SLA
- Footer: "Plus everything in Scale: 30 industries, full KB packs, all integrations."

**Speaker notes**
Walk the bullets but linger on three: (1) the sub-account cap is soft â€” we lift it for anyone with a credible roster, just ask; (2) RevTry minutes are *pooled*, which is huge because most clients use 20-50 minutes/mo and a few use 500, so pooling lets you re-allocate without per-client overage panic; (3) snapshot library is the compounding asset â€” every winning funnel you build becomes a template you redeploy across your book. After 6 months an agency that has snapshot'd 15 verticals onboards new clients in under 30 minutes.

---

### Slide 5 â€” The economics

**On-slide content**
- Two-column P&L
  - Revenue: 20 clients Ã— $997/mo = $19,940/mo
  - COGS: $997/mo (your FunelAI seat)
  - Gross margin: $18,943/mo = **95%**
- Below: "What happens at 50 clients? $48,853/mo gross profit. 98% margin."
- Footer: "Pricing your clients $497-$2,000/mo is normal. We coach you on this in module 4."

**Speaker notes**
This slide closes deals. The agency owner is doing the math in their head against their current agency P&L, where they're at 30-50% gross margins after labor. Highlight that the $997 is *all-in* â€” no per-funnel fees, no per-sub-account fees, no usage gotchas as long as you stay within the pool. Acknowledge that they'll still have *some* labor cost (ads management, client comms) but it's a fraction of the build-cost they have today. We've seen agencies on the Scale tier convert to Agency and double their roster within 90 days with the same team.

---

### Slide 6 â€” Live demo

**On-slide content**
- Just: "Pick an industry. We'll build a funnel."
- Big input box (illustrative).

**Speaker notes**
This is the moment. Ask the room: what's the most painful vertical you have right now? They'll shout something â€” dental, HVAC, med-spa, real estate, whatever. Take it, plug in a real local business URL from that vertical (sales rep has a list of pre-warmed safe URLs to use â€” never use a competitor agency's client). Generate. Walk through what came out: landing page, copy, offer, brand color match, email 1, SMS 1, the voice agent's opening line. Don't skip the compliance pre-check â€” that's where TCPA-aware competitors lose to us. If anything looks off, that's fine â€” show the regenerate button. The demo should land at 90 seconds wall-clock, including narration. If it takes longer your network is the issue; fall back to the recorded version (always queued in browser tab 2).

---

### Slide 7 â€” White-label: your branding, your domain, your support tier

**On-slide content**
- Three before/after pairs:
  - Login screen: FunelAI logo â†’ Your agency logo
  - Domain: `app.funelai.com/wsp_abc` â†’ `app.acmemarketing.com`
  - Outbound email: `noreply@funelai.com` â†’ `noreply@acmemarketing.com`
- Footer: "Your clients never see our brand. Your name, our engine."

**Speaker notes**
Explain what white-label actually means here: clients log in at your domain, see your logo on every screen, receive every transactional email from your sending domain (we set up DKIM/DMARC for you), and â€” critically â€” when they need support, they email *you*, not us. You have a private agency-tier Slack with our team for escalations, but to your clients we're invisible. This is non-negotiable for agencies who've been burned by "white-label" that leaks our brand in five places. We hold ourselves to the standard: zero leakage of the word "FunelAI" on a client-facing surface unless the agency opts in.

---

### Slide 8 â€” The 30 industries supported on Day 1

**On-slide content**
- 6Ã—5 grid of industry icons:
  - Home services: HVAC, plumbing, roofing, solar, pest control, landscaping
  - Health: dental, med-spa, chiropractic, physical therapy, mental health, vet
  - Professional: law (PI), law (family), CPA/tax, financial advisor, insurance, real estate
  - Local retail: auto repair, auto detail, jeweler, salon, fitness, gym
  - Hospitality: restaurant, catering, event venue, photographer, wedding planner, travel
- Footer: "Each industry ships with a vertical KB pack: regulatory rules, average CPL benchmark, top-converting offers, 8 voice scripts. New verticals quarterly."

**Speaker notes**
The KB packs are where we beat generic AI tools. Each pack is built by a domain expert (e.g., for HVAC, a 20-year HVAC marketer wrote our offer library and a TCPA lawyer reviewed the SMS templates). Reference KB-pack template (Doc 02a) and the solar example (Doc 02b) if anyone in the room wants to see depth. Encourage them to specialize: agencies that pick 1-3 verticals and dominate them have 3x the LTV of generalist agencies. Module 3 of the certification covers vertical-selection strategy.

---

### Slide 9 â€” RevTry voice agent: how it changes lead-to-close conversion

**On-slide content**
- Big stat: "Inbound leads called within 60 seconds convert at 8x the rate of leads called after 5 minutes." â€” Source: Lead Response Management Study (Oldroyd et al.)
- Below: a horizontal flow: "Lead form â†’ Webhook (2s) â†’ RevTry calls (45s) â†’ Qualified handoff to client (booked appointment or warm SMS thread)"
- Footer: "5,000 minutes pooled. ~$0.05/min above pool."

**Speaker notes**
The 8x stat is the most powerful number in this deck for sophisticated agency owners. Most of their clients aren't calling leads back within 60 seconds â€” they're calling within 4 hours, if at all. RevTry's job is to be the speed-to-lead layer the client always wished they had a receptionist for. The voice agent qualifies, books, and warm-transfers when appropriate. Module 6 of the certification teaches script customization. Mention: we're not selling "AI receptionist" â€” we're selling "the first 60 seconds after a lead converts." That framing matters.

---

### Slide 10 â€” Compliance moat: HIPAA, TCPA, FTC â€” built in

**On-slide content**
- Three shield icons:
  - HIPAA: BAA available for healthcare verticals; PHI-aware data handling
  - TCPA: Quiet-hours enforcement, written-consent capture, DNC list scrubbing
  - FTC: No deceptive claims, reviewable disclaimer library, testimonial provenance tracking
- Footer: "Your liability, drastically reduced. Our liability, contractually shared."

**Speaker notes**
Agencies undervalue compliance until they get sued or their client gets sued. We've seen $500k TCPA settlements wipe out small agencies. We do the unsexy work: every SMS template has been reviewed against TCPA, every healthcare funnel has PHI handling baked in, our trust & safety queue (see Doc 07b) reviews edge cases. Mention the Publish Acknowledgment & Indemnification doc (05e) â€” by signing it, both sides know exactly who owns what risk, and that clarity is a sales asset for agencies pitching enterprise local businesses.

---

### Slide 11 â€” FunelAI Awards + Community

**On-slide content**
- Visual: trophy + Slack/Discord logos
- Bullets:
  - FunelAI Awards: quarterly recognition for top-converting funnels by vertical
  - Community: 2,000+ agency owners and operators sharing playbooks
  - Featured client spotlights on our marketing site (drives leads back to the agency)
- Footer: "Your clients want to be celebrated. Use us as the trophy case."

**Speaker notes**
This is the retention slide. Local-business owners â€” your clients â€” are starved for recognition. The FunelAI Awards is a free quarterly program where we feature winning funnels, and the *agency that built them* is credited prominently. Agencies report that submitting clients to Awards is one of the highest-leverage QBR moments because it lets the client tell their spouse "I won an award" and reframes the agency relationship from cost to status. The community Slack is also where you'll meet your future referral partners â€” see Section 8 on the revenue share program.

---

### Slide 12 â€” The fulfillment dashboard

**On-slide content**
- Screenshot: a table of 12 client logos with columns for status, leads MTD, RevTry mins, conversion rate, health (red/yellow/green), next action
- Headline: "Manage 50 clients in one pane."
- Footer: "Bulk actions, health scores, task queue, white-labeled exports."

**Speaker notes**
Walk through the screenshot live (this is the second mini-demo). Highlight: (1) the health column shows you at a glance which clients to focus on â€” green clients run themselves, yellow get a check-in, red get a calendar invite today; (2) the task queue shows you what's blocking â€” "client A needs approval on Variant B," "client C's Meta ad got rejected, needs disclaimer fix"; (3) bulk actions let you clone last quarter's winning funnel across all dentist clients in one click. Section 5 of this doc is the full product spec.

---

### Slide 13 â€” Snapshot library: clone winning funnels across clients

**On-slide content**
- Visual: a funnel icon copying to 5 client logos
- Bullets:
  - Save any funnel as a snapshot (one click)
  - Clone into any client sub-account â€” brand colors, copy variables, contact info auto-substituted
  - Track which snapshots perform best across your book
- Footer: "Your IP. We host. You compound."

**Speaker notes**
This is the slide that turns agencies into platforms. After you've built and tested 30 dental funnels, you have a library of what works. Snapshot that library, and every new dental client onboards in 20 minutes with a proven funnel â€” they're not getting your guess, they're getting your aggregate book's best performer. Important: snapshots are *your* IP. We don't share your snapshots with other agencies (unless you opt in to the public snapshot exchange, where revenue share applies â€” covered in Section 8).

---

### Slide 14 â€” FunelAI for Agencies certification

**On-slide content**
- Big badge graphic: "FunelAI Certified Agency"
- Bullets:
  - 30-minute video course + 20-question exam (covered in Section 3)
  - Listed in the public Partner Directory (we drive leads to you)
  - Private agency Slack with our product + leadership team
  - Beta-feature early access
- Footer: "Cert is free. Comes with your Agency-tier seat."

**Speaker notes**
The certification is doing three jobs at once: (1) it ensures the agency actually knows how to use the platform, which dramatically improves their client outcomes and reduces our support load; (2) it gives the agency a credibility signal they can sell with â€” "FunelAI Certified" goes on their website and pitch decks; (3) the Partner Directory is a real lead-gen channel â€” we route prospects who don't want to manage their own platform to certified agencies, and we don't take a cut of that referral. The cert takes one afternoon. Day 1 of being a customer should also be day 1 of being certified.

---

### Slide 15 â€” Pricing + how to start

**On-slide content**
- Pricing block:
  - Agency tier â€” $997/mo, billed monthly
  - 14-day full-feature trial, no credit card required
  - First 90 days include white-glove onboarding from a partnerships lead
- CTA: "Book a demo with our partnerships team. Calendly link / QR code."
- Footer: "Or start the trial now: funelai.com/agency"

**Speaker notes**
Close with a clear next step. There are two paths: (1) self-serve trial â€” for agencies who want to poke around; (2) book a partnerships call â€” for agencies with 10+ existing clients who want help on migration. Both are fine; the second path produces better-fit customers and higher LTV, so we incentivize it with white-glove onboarding. Ask for the close: "Who in this room can be set up with their first sub-account before end of day?" Stop talking. Wait.

---

## Section 2 â€” Client Onboarding Checklist

**Format:** 5-step process, ~10 business days from kickoff to first lead. White-label-friendly: every artifact below is templated so the agency replaces logos, sender names, and color tokens. The agency-facing version of this checklist lives in the FunelAI app under **Resources â†’ Onboarding Templates** and exports to Notion, Asana, ClickUp, and Trello.

For each step we list: agency tasks, our system tasks, deliverables, timeline, common pitfalls.

---

### Step 1 â€” Discovery call

**Timeline:** Day 0. 45-minute call.

**Agency tasks**
- Run the standard discovery script (template provided). The 10 must-ask questions:
  1. What vertical / sub-vertical are you in? (Used to select KB pack.)
  2. Who is your ideal customer? (Demographics, geography, problem they're solving.)
  3. What's your average customer lifetime value? (Sets ad-budget ceiling.)
  4. What does your current marketing look like? (Channels, monthly spend, current CPL.)
  5. What's the #1 offer that works for you today? (Seeds the funnel offer.)
  6. What's your monthly lead volume goal for the next 90 days?
  7. What CRM/calendar/payment systems are you using? (Sets integration scope.)
  8. Do you have ad accounts (Meta/Google) already running? Under your ownership?
  9. Any regulatory concerns we should know about? (Healthcare, finance, legal.)
  10. Who on your team will be the daily contact for approvals?
- Record the call (with consent) and upload to the client's sub-account â†’ Documents.
- Capture answers into the **Discovery Worksheet** in the sub-account.

**Our system tasks**
- Auto-create a sub-account on agency confirmation (event: `subaccount_created`).
- Pre-load the KB pack for the chosen vertical.
- Set the recording's transcript as a context document for the funnel-grader.

**Deliverables**
- Completed Discovery Worksheet (PDF export, white-labeled).
- Signed Service Agreement (agency's template, our Publish Acknowledgment doc 05e attached).
- Calendar invite for Step 2 sent.

**Common pitfalls**
- Client doesn't know their LTV â†’ agency provides a vertical-typical estimate from the KB pack benchmark.
- Client wants 10 verticals served by one funnel â†’ agency must enforce one-funnel-per-offer or conversion craters. Module 4 of the certification covers this conversation.
- Client refuses to share ad account ownership â†’ flag this as a yellow status until resolved; the agency cannot run paid ads on the client's behalf without it.

---

### Step 2 â€” Brand intake

**Timeline:** Day 1-3. Async + one 30-minute call to close gaps.

**Agency tasks**
- Send the **Brand Intake Form** (white-labeled). Requested assets:
  - Logo (SVG or transparent PNG, 3 sizes if possible)
  - Brand colors (hex codes â€” or "we'll pull from your site")
  - Fonts (or the URL where we can detect them)
  - 3-10 photos: founder, team, location, work-in-progress, finished work, happy customer
  - Existing testimonials, reviews (Google/Yelp/Facebook) â€” with permission
  - Existing offers or specials they want featured
- For clients with nothing: agency walks them through a 15-minute photo shoot on their phone, follows our **"Zero-Asset Onboarding"** guide (stock-photo selection from our licensed library + AI-generated headshots in same style).

**Our system tasks**
- URL crawler pulls brand colors, fonts, headline copy, navigation structure, contact info, testimonials, business hours.
- Brand-detection model returns a confidence score; under 0.7 triggers a manual review flag for the agency.
- Photo upload pipeline runs auto-tagging (`team`, `location`, `service`, `customer`) and resolution checks.
- KB pack offer library is filtered to the client's specific sub-vertical and geo.

**Deliverables**
- Populated brand profile in the sub-account (visible to agency and â€” if shared â€” to the client).
- A "what we found" summary email sent from the agency to the client, asking for any corrections.

**Common pitfalls**
- Client logo is a JPEG with white background â†’ agency uses our built-in background-remover, or rebuilds in 2 minutes with our logo generator. Do not let this block the onboarding.
- Brand colors clash with conversion best practice (e.g., pale yellow CTA on white) â†’ we auto-suggest a compliant accent color, agency presents it as our recommendation.
- Client has no testimonials â†’ agency uses our "First 5 Reviews" outreach template to collect them from existing customers in parallel; meanwhile the funnel uses generic social proof.

---

### Step 3 â€” Funnel generation + approval

**Timeline:** Day 3-7. One 60-minute live session + up to 3 iteration rounds.

**Agency tasks**
- Host a screen-share where the funnel is generated *live in front of the client*. This is the wow moment â€” never skip the live generation. Agencies who pre-generate and present a finished funnel get 30% lower client engagement scores in our data.
- Walk through every page: landing, thank-you, email 1, email 2, SMS 1, voice script opening.
- Capture client feedback in the iteration queue. Each iteration has a turnaround SLA of 4 business hours.
- Get explicit sign-off via the in-app **Funnel Approval** button (this writes a `funnel_approved` event with timestamp and user, used for dispute resolution).

**Our system tasks**
- Funnel-grader generates first draft in <60 sec.
- Compliance pre-check runs (TCPA, FTC, HIPAA where applicable).
- Brand-fit score returned for the agency to review before showing the client.
- Iteration loop accepts natural-language edits ("make the headline more urgent," "swap the founder photo to the team photo").
- Approval signed acknowledgment per Doc 05e.

**Deliverables**
- Approved funnel (status: `approved`, ready to publish).
- Signed Publish Acknowledgment (Doc 05e).
- Iteration log (used in the QBR to show client value delivered).

**Common pitfalls**
- Client wants to design-by-committee with their cousin â†’ contract should specify one named approver. Enforce this.
- Client keeps asking for "one more iteration" past round 3 â†’ agency caps at 3 included rounds, $250 per round after. Module 4 of the certification covers this language.
- Client doesn't actually approve, just says "looks good" verbally â†’ no approval = no publish. Always require the button click; it covers everyone legally.

---

### Step 4 â€” Launch package

**Timeline:** Day 7-10.

**Agency tasks**
- Walk the client through connecting their ad accounts (Meta Business Manager admin invite, Google Ads MCC link).
- Configure the custom domain â€” agency typically chooses `[client-name].agency-domain.com` or, for premium clients, `go.[client-domain].com` with CNAME setup.
- Configure RevTry voice agent: select script template, customize opening line, set business-hours routing, set warm-transfer phone number.
- Seed the CRM with existing contact lists from the client's prior tools (CSV upload or supported-CRM migration).
- Configure notification routes: who at the client gets new-lead SMS, who gets daily digest.
- Set up the client's first ad campaigns at $50-$200/day starting budget, depending on vertical CPL and client LTV.

**Our system tasks**
- Ad-account-link integration runs (Doc 04 covers integration patterns).
- Custom domain DNS verification + SSL provisioning (typically 5-30 min).
- RevTry phone number provisioned in the client's geography; SMS A2P 10DLC registration kicked off if the client doesn't have a brand registered.
- CRM import pipeline runs, dedupes against existing contacts, flags PII conflicts.
- First-publish event fires (`funnel_published`); webhooks notify agency + client.

**Deliverables**
- Live funnel at the client's custom domain.
- First Meta and/or Google campaign running.
- RevTry answering inbound calls.
- A welcome-to-launch email from the agency to the client with the **Launch Day Cheat Sheet** (white-labeled PDF).

**Common pitfalls**
- A2P 10DLC registration takes 2-7 days; if SMS is critical, kick this off in Step 2, not Step 4.
- Client's Meta account was previously suspended â†’ check Business Manager status before promising launch dates.
- RevTry minutes pool is already depleted for the month â†’ either upgrade pool or stagger client launches; the fulfillment dashboard warns at 80% pool utilization.

---

### Step 5 â€” Ongoing optimization

**Timeline:** Recurring â€” weekly + monthly + quarterly cadence.

**Agency tasks**
- **Weekly:** 15-minute async check-in. Review the auto-generated weekly digest (sent every Monday) and Slack/email any priority items to the client. Approve or reject the week's A/B test recommendations.
- **Monthly:** 30-minute review call. Walk through the monthly white-labeled PDF report. Discuss any creative refreshes needed (we auto-flag creative fatigue when CTR drops 20% week-over-week).
- **Quarterly:** Strategic review. Re-pricing conversation if client's lead volume has materially changed. Submit the client to FunelAI Awards if they had a winning quarter. Talk renewal.

**Our system tasks**
- A/B test engine proposes new variants based on the snapshot library and the client's vertical KB pack.
- Creative-fatigue detector monitors CTR and frequency, raises a task in the fulfillment dashboard.
- Weekly digest email auto-composed using the prior week's actuals.
- Monthly report renders as a white-labeled PDF (agency logo, agency contact info, agency sending domain).
- Cost governor (Doc 07c) catches runaway ad spend and pauses campaigns above the configured ceiling.

**Deliverables**
- Weekly digest email.
- Monthly PDF report.
- Quarterly business review deck (auto-generated, agency adds commentary).

**Common pitfalls**
- Agency skips the weekly approval â†’ A/B tests pile up unapproved. The dashboard's task queue surfaces this; treat it as a yellow-health signal.
- Client expects a strategist on every call â†’ set expectations at Step 1 that monthly is the strategist cadence; weekly is data-only.
- "Ongoing optimization" becomes "constant rebuilds" â†’ enforce a quarterly cadence for major funnel changes. Stability is a feature.

---

## Section 3 â€” Certification Course: "FunelAI for Agencies"

**Format:** 30-minute video course, 8 modules, recorded by the founder + product + partnerships leads. Hosted on the in-app Academy. Certification quiz at the end (20 questions, 80% passing).

**On pass:**
- FunelAI Certified Agency badge (SVG + 3 PNG sizes) for use on the agency's website
- Listing in the public Partner Directory at `funelai.com/partners` with vertical specialization, geography, agency bio, and a direct CTA-to-book button
- Access to the private agency Slack (`#agency-partners`) with product team, partnerships leads, and other certified agencies
- Beta-feature early access (new agents, new industries, new integrations rolled to certified agencies 2-6 weeks before GA)
- Quarterly invite to the closed Agency Partner Roundtable (live Zoom with product leadership)

Recertification: annual. New module added each year covering net-new features.

---

### Module 1 â€” The agency growth playbook (intro by founder)

**Duration:** 4 minutes.

**Script outline**
Cold open: founder addresses the agency owner directly. "If you're watching this, you already run an agency. You don't need a sales pitch â€” you need a playbook that lets you serve 3x the clients with the same team. That's what this course is."

Three points:
1. **The shape of an agency that wins with FunelAI:** specialized, productized, retention-focused. Not "we do everything for everyone."
2. **The shape of an agency that loses with FunelAI:** generalist, custom-everything, hourly-billing. The platform won't save a service business addicted to scope creep.
3. **What the next 26 minutes will give you:** product fluency, packaging frameworks, retention systems, compliance posture, scaling playbook.

Close with the certification promise: badge, directory listing, Slack, beta access.

---

### Module 2 â€” Platform tour: sub-accounts, white-label, snapshot library

**Duration:** 5 minutes.

**Script outline**
Screen-share of the agency parent workspace. Walkthrough:
- Parent dashboard view: list of all client sub-accounts, health scores, pool utilization.
- Creating a new sub-account in <30 seconds.
- White-label settings: domain, logo, primary color, sender email, support email. Show the before/after of a client login screen.
- Snapshot library: saving a funnel as a snapshot, cloning it into a fresh sub-account, the brand-substitution behavior.
- The fulfillment dashboard (full spec in Section 5 of this doc).

End-of-module hands-on: viewer is asked to create their first sub-account before continuing.

---

### Module 3 â€” The 30 industries deep-dive (which to specialize in for highest LTV)

**Duration:** 4 minutes.

**Script outline**
This is the strategic module. Walk through the 30 verticals with three axes per vertical:
- **Average client LTV to the agency** (months of retention Ã— monthly fee)
- **Vertical CPL benchmark** (used to size client budgets)
- **Regulatory complexity** (low/med/high â€” affects fulfillment cost)

Highest-LTV verticals: med-spa (LTV $24k+, low churn), law-PI (LTV $30k+, very low churn but high regulatory), financial advisor (LTV $20k+, high regulatory). Highest-volume verticals: home services (LTV $8k, easy fulfillment, but more competitive). Easiest-to-start verticals for a new FunelAI agency: dental, chiropractic, HVAC, salon â€” all have proven KB packs and forgiving CPL economics.

Recommendation: pick 1-3 verticals. Specialists charge 2-3x what generalists charge. We list your specialization in the Partner Directory and route prospects accordingly.

---

### Module 4 â€” How to package and price (3 service tiers with margin breakdowns)

**Duration:** 4 minutes.

**Script outline**
Three packages an agency should offer:

**Starter â€” $497/mo**
- One funnel, one offer.
- Email + SMS sequences.
- 100 RevTry minutes.
- Monthly report.
- Agency COGS: ~$50/mo allocated. Margin: ~90%.
- Sells to: solo operators, side businesses, clients testing the channel.

**Growth â€” $997/mo**
- Up to 3 funnels per offer.
- Email + SMS + voice + ad management on Meta or Google.
- 300 RevTry minutes.
- Weekly digest + monthly report + monthly review call.
- Agency COGS: ~$100/mo allocated. Margin: ~90%.
- Sells to: established local businesses, 80% of an agency's roster.

**Scale â€” $1,997/mo**
- Unlimited funnels.
- Email + SMS + voice + ad management on Meta and Google.
- 1,000 RevTry minutes.
- Weekly call + monthly report + quarterly business review.
- Agency COGS: ~$200/mo allocated. Margin: ~90%.
- Sells to: multi-location, multi-offer clients; clients with $50k+/mo ad spend.

Add-ons:
- Build fee (one-time): $1,500-$5,000 depending on tier and brand complexity.
- Overage RevTry minutes: $0.10/min billed to client (your COGS: $0.05).
- Ad-spend management fee: 10-15% of monthly ad spend on top of retainer.

Pricing principle: charge 10x your COGS. The platform makes this possible.

---

### Module 5 â€” Client retention through FunelAI Awards + Community

**Duration:** 3 minutes.

**Script outline**
Retention is the agency's hidden gross margin. A client who stays 24 months is 4x more valuable than one who stays 6. Three retention levers we provide:

1. **FunelAI Awards (quarterly):** submit winning client funnels for recognition. Award recipients get a website badge, a feature in our newsletter, and (if they consent) a case study on our site that credits the agency. Submitting a client is a free QBR moment that always lands well.
2. **Community:** invite high-value clients to the public FunelAI community (separate from the agency Slack). This builds peer-network attachment that makes switching agencies painful.
3. **The monthly report:** the white-labeled PDF report is the single most powerful retention tool we ship. Make sure it includes one specific success story per month. Module 5 hands-on: write the report-narrative template for your first vertical.

---

### Module 6 â€” RevTry voice script customization

**Duration:** 4 minutes.

**Script outline**
The default scripts are good. The customized ones are great. Cover:

- The 5-element voice script: greeting â†’ qualification questions (max 3) â†’ value proposition â†’ next step (book / transfer / SMS follow-up) â†’ graceful fallback.
- The tone dial: "professional," "warm," "casual," "high-energy." Match to vertical (e.g., financial advisor = professional; med-spa = warm; HVAC = casual).
- Quiet hours and weekend behavior (TCPA-aware).
- When to warm-transfer vs. when to book vs. when to SMS-only â€” the decision tree.
- How to A/B test scripts (run two variants, switch traffic 50/50, measure book rate).

Hands-on: customize the voice script for your first vertical and listen to a generated sample call.

---

### Module 7 â€” Compliance for agencies (your liability vs ours)

**Duration:** 3 minutes.

**Script outline**
The clean version: we own platform-level compliance (TCPA-compliant infrastructure, HIPAA-eligible plan, FTC-aware templates). The agency owns the use of the platform (the offers they choose, the targeting they apply, the consent they collect). The client owns their business claims.

The Publish Acknowledgment doc (Doc 05e) codifies this three-way split. Every funnel publish forces an explicit acknowledgment from the agency on behalf of the client.

The three things agencies most often get wrong:
1. **Buying lead lists and uploading them as warm contacts.** Don't. TCPA explicit-consent requirements still apply, and our platform will flag and quarantine bulk uploads that fail consent provenance.
2. **Running healthcare funnels without the BAA.** If the vertical is HIPAA-relevant, request the BAA from your FunelAI account manager before publish.
3. **Promising specific outcomes ("we guarantee 50 leads") in copy.** FTC frowns on this. Use ranges and disclaimers; the KB pack offer library is FTC-clean by default.

---

### Module 8 â€” Scaling past 50 clients (fulfillment ops + team structure)

**Duration:** 3 minutes.

**Script outline**
At 50+ clients, the agency owner cannot be in the critical path. Recommended team structure:

- **1 Agency Owner** â€” sales, partnerships, strategic accounts.
- **1 Account Manager per ~25 clients** â€” weekly digests, monthly calls, QBRs. Hire profile: communicator, not a strategist.
- **1 Funnel Operator per ~50 clients** â€” runs the platform: brand intake, funnel generation, approvals, A/B test queue. Hire profile: operations-detail-oriented.
- **1 Ad Buyer per ~30 active-paid-ad clients** â€” Meta + Google management. Hire profile: trader mindset, dashboard-fluent.
- **Fractional compliance reviewer** â€” quarterly review of templates and disclaimer use; usually 4 hours/month.

Tooling beyond FunelAI: a project management tool (we recommend Linear or ClickUp), a billing system that handles passthrough or absorbed billing (Stripe Connect works well), a contract tool (Docusign or PandaDoc), and a Slack or Discord workspace.

When you cross 100 clients you should be selling the agency, hiring an agency director, or starting a vertical-specialty spin-off. Reach out to your partnerships lead â€” we know operators in your stage.

---

### Certification quiz (20 questions, 80% passing)

Mix of multiple-choice and scenario-based questions. Sample set:

1. The Agency tier costs $___ per month. (a) $497 (b) $997 (c) $1,997 (d) $2,997. **Correct: b.**
2. How many RevTry minutes are pooled in the Agency tier per month? (a) 1,000 (b) 2,500 (c) 5,000 (d) Unlimited. **Correct: c.**
3. True or False: White-label means client-facing emails come from the agency's sending domain. **Correct: True.**
4. The recommended number of client iteration rounds during funnel approval is: (a) 1 (b) 3 (c) 5 (d) Unlimited. **Correct: b.**
5. Which of the following is NOT a vertical with a Day-1 KB pack? (a) HVAC (b) Med-spa (c) Cryptocurrency trading (d) Family law. **Correct: c.**
6. Under TCPA, when must SMS quiet hours be enforced? (Multi-select: morning before 8am, evening after 9pm, weekends, holidays, recipient's local time). **Correct: morning before 8am, evening after 9pm â€” by recipient's local time.**
7. Snapshot library lets you: (a) View other agencies' funnels (b) Save and clone funnels across your own clients (c) Both (d) Neither. **Correct: b.**
8. A client refuses to grant access to their Meta Business Manager. Best practice: (a) Run ads from your personal account (b) Refuse to onboard until resolved (c) Mark as yellow status and proceed with non-paid channels until resolved (d) Create a new Business Manager in your name. **Correct: c.**
9. The FunelAI Publish Acknowledgment (Doc 05e) governs which of: (a) Agency liability (b) Client business claims (c) Platform compliance posture (d) All of the above. **Correct: d.**
10. A client's CTR drops 25% week-over-week. The fulfillment dashboard will: (a) Auto-pause the campaign (b) Raise a task in the queue (c) Send a Slack alert to the agency (d) Both b and c. **Correct: d.**
11. The recommended pricing principle for agency packages is to charge ___ your COGS. (a) 2x (b) 5x (c) 10x (d) Whatever the market allows. **Correct: c (with d as the practical override).**
12. Highest-LTV vertical typically is: (a) Restaurants (b) Med-spa (c) Personal injury law (d) Auto detail. **Correct: c.**
13. Snapshot brand-substitution does NOT auto-substitute which of: (a) Brand colors (b) Logo (c) Client testimonials (d) Phone number. **Correct: c â€” testimonials must be re-supplied per client.**
14. A2P 10DLC registration typically takes: (a) Same day (b) 2-7 days (c) 30 days (d) Doesn't apply to agencies. **Correct: b.**
15. The FunelAI Awards cadence is: (a) Monthly (b) Quarterly (c) Annual (d) Continuous. **Correct: b.**
16. Pooled RevTry minutes overage cost agencies approximately: (a) $0.01/min (b) $0.05/min (c) $0.25/min (d) $1.00/min. **Correct: b.**
17. The agency revenue share for referring another agency is: (a) 5% one-time (b) 10% recurring (c) 20% one-time (d) None. **Correct: b.**
18. A new sub-account can be created in approximately: (a) 30 seconds (b) 1 hour (c) 1 business day (d) 1 week. **Correct: a.**
19. Recommended team ratio: 1 Funnel Operator per ___ clients. (a) 10 (b) 25 (c) 50 (d) 100. **Correct: c.**
20. Certified agencies receive beta-feature access how long before GA, typically? (a) Same day as GA (b) 2-6 weeks before (c) 6 months before (d) Never. **Correct: b.**

Quiz can be retaken every 7 days; no limit. We track first-attempt pass rate as a signal for course quality.

---

## Section 4 â€” Sub-Account Architecture (Engineering Spec)

**Scope:** Database, IAM, billing, white-label, snapshot, and audit-log additions required to support agency-tier customers. All schema additions reference and extend Doc 03 (Event Taxonomy and Database Schemas). RLS conventions from Doc 03 Â§PART B carry through.

### 4.1 Conceptual model

```
AgencyAccount (parent)
  â”œâ”€ Workspace (agency's own; type = "agency_internal")
  â”œâ”€ Workspace (client A; type = "agency_subaccount", parent_agency_id = agency.id)
  â”œâ”€ Workspace (client B; type = "agency_subaccount", parent_agency_id = agency.id)
  â””â”€ â€¦ up to 100 by default (soft cap)
```

- **AgencyAccount** is a new top-level entity that owns billing, white-label config, the snapshot library, and the pool resources (RevTry minutes, support hours).
- **Workspaces** remain the unit of tenancy. We do not collapse the workspace abstraction; sub-accounts are workspaces with `parent_agency_id` set.
- **Users** can have memberships on multiple workspaces; agency users get a synthetic membership on every child workspace via `agency_membership` (role-scoped) rather than explicit per-workspace rows. This keeps the membership table from exploding at scale.

### 4.2 Schema additions (Postgres / Prisma-aligned)

Schema follows Doc 03 conventions: ULID primary keys, `created_at`/`updated_at`/`deleted_at`, RLS on workspace-scoped tables, snake_case columns, `BIGINT` minor-units money.

```sql
-- New top-level: agency account
CREATE TABLE agency_accounts (
  id                    TEXT PRIMARY KEY,           -- agc_01HXâ€¦
  owner_user_id         TEXT NOT NULL REFERENCES users(id),
  legal_name            TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active',  -- active | suspended | closed
  plan                  TEXT NOT NULL DEFAULT 'agency',
  subaccount_cap        INT  NOT NULL DEFAULT 100,
  revtry_minutes_pool   INT  NOT NULL DEFAULT 5000,      -- monthly allotment
  revtry_minutes_used   INT  NOT NULL DEFAULT 0,         -- current month usage
  pool_reset_at         TIMESTAMPTZ NOT NULL,
  whitelabel_id         TEXT REFERENCES whitelabel_configs(id),
  partner_directory_listed BOOLEAN NOT NULL DEFAULT FALSE,
  certified_at          TIMESTAMPTZ,
  certified_until       TIMESTAMPTZ,
  affiliate_code        TEXT UNIQUE,                     -- for rev-share program
  paypal_payout_email   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX agc_owner_idx ON agency_accounts (owner_user_id);

-- Workspaces gain a parent reference
ALTER TABLE workspaces
  ADD COLUMN parent_agency_id   TEXT REFERENCES agency_accounts(id),
  ADD COLUMN workspace_type     TEXT NOT NULL DEFAULT 'standalone',  -- standalone | agency_internal | agency_subaccount
  ADD COLUMN billing_mode       TEXT NOT NULL DEFAULT 'self',        -- self | passthrough | absorbed
  ADD COLUMN client_visible     BOOLEAN NOT NULL DEFAULT TRUE;        -- false = agency-only, client cannot log in yet

CREATE INDEX wsp_parent_agency_idx ON workspaces (parent_agency_id) WHERE parent_agency_id IS NOT NULL;

-- White-label config (one row per agency)
CREATE TABLE whitelabel_configs (
  id                  TEXT PRIMARY KEY,            -- wlc_01HXâ€¦
  agency_id           TEXT NOT NULL UNIQUE REFERENCES agency_accounts(id) ON DELETE CASCADE,
  primary_domain      TEXT NOT NULL,               -- clients.acmemarketing.com
  domain_verified_at  TIMESTAMPTZ,
  app_logo_url        TEXT,
  email_logo_url      TEXT,
  primary_color_hex   CHAR(7),
  accent_color_hex    CHAR(7),
  sender_domain       TEXT,                        -- e.g. mail.acmemarketing.com
  sender_dkim_status  TEXT NOT NULL DEFAULT 'pending',
  sender_dmarc_status TEXT NOT NULL DEFAULT 'pending',
  support_email       TEXT,
  support_phone       TEXT,
  favicon_url         TEXT,
  legal_company_name  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agency-level memberships (synthetic access to all child workspaces)
CREATE TABLE agency_memberships (
  id              TEXT PRIMARY KEY,                -- agm_01HXâ€¦
  agency_id       TEXT NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  role            TEXT NOT NULL,                   -- owner | admin | operator | account_manager | analyst
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at       TIMESTAMPTZ,
  removed_at      TIMESTAMPTZ,
  UNIQUE (agency_id, user_id) WHERE removed_at IS NULL
);
CREATE INDEX agm_user_idx ON agency_memberships (user_id);

-- Workspace-level client-view memberships (clients can only see their own workspace)
-- These still use the existing workspace_members table with role = 'client_view'.
-- See Doc 03 Â§B for the workspace_members schema; we add one new role enum value.

-- Snapshot library: agency-owned templates clonable into any child workspace
CREATE TABLE snapshots (
  id                  TEXT PRIMARY KEY,            -- snp_01HXâ€¦
  agency_id           TEXT NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  source_funnel_id    TEXT REFERENCES funnels(id),  -- nullable: snapshot may be built from scratch
  source_workspace_id TEXT REFERENCES workspaces(id),
  title               TEXT NOT NULL,
  vertical            TEXT NOT NULL,                -- references KB pack vertical
  description         TEXT,
  payload             JSONB NOT NULL,               -- the funnel definition + assets manifest
  payload_schema_ver  INT  NOT NULL DEFAULT 1,
  is_public           BOOLEAN NOT NULL DEFAULT FALSE, -- opt-in to public snapshot exchange
  total_clones        INT  NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX snp_agency_idx ON snapshots (agency_id);
CREATE INDEX snp_vertical_idx ON snapshots (vertical) WHERE is_public = TRUE;

-- Snapshot clone events (every materialization)
CREATE TABLE snapshot_clones (
  id                  TEXT PRIMARY KEY,            -- snc_01HXâ€¦
  snapshot_id         TEXT NOT NULL REFERENCES snapshots(id),
  target_workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  resulting_funnel_id TEXT REFERENCES funnels(id),
  cloned_by_user_id   TEXT NOT NULL REFERENCES users(id),
  variable_overrides  JSONB,                        -- brand color, copy, contact, etc.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX snc_snapshot_idx ON snapshot_clones (snapshot_id);
CREATE INDEX snc_workspace_idx ON snapshot_clones (target_workspace_id);

-- RevTry pool usage ledger (append-only)
CREATE TABLE pool_usage_ledger (
  id              TEXT PRIMARY KEY,                -- pul_01HXâ€¦
  agency_id       TEXT NOT NULL REFERENCES agency_accounts(id),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  resource        TEXT NOT NULL,                   -- 'revtry_minutes' | future pools
  amount          INT  NOT NULL,                   -- minutes consumed (or negative for credits)
  call_id         TEXT,                            -- references revtry call
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pul_agency_period_idx ON pool_usage_ledger (agency_id, occurred_at);

-- Pool allocation policy (agency decides how to share the pool)
CREATE TABLE pool_allocations (
  id              TEXT PRIMARY KEY,                -- pal_01HXâ€¦
  agency_id       TEXT NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  resource        TEXT NOT NULL,
  policy          TEXT NOT NULL,                   -- 'unlimited' | 'cap' | 'reserve'
  cap_amount      INT,                             -- when policy = cap
  reserve_amount  INT,                             -- when policy = reserve
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

-- Agency-level audit log (rolls up child workspace audits)
CREATE TABLE agency_audit_log (
  id              TEXT PRIMARY KEY,                -- aal_01HXâ€¦
  agency_id       TEXT NOT NULL REFERENCES agency_accounts(id),
  workspace_id    TEXT REFERENCES workspaces(id),  -- nullable for agency-scoped actions
  actor_user_id   TEXT REFERENCES users(id),
  action          TEXT NOT NULL,                   -- snake_case action name
  target_type     TEXT,
  target_id       TEXT,
  metadata        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX aal_agency_time_idx ON agency_audit_log (agency_id, occurred_at DESC);

-- Affiliate / revenue share
CREATE TABLE affiliate_referrals (
  id                  TEXT PRIMARY KEY,            -- afr_01HXâ€¦
  referrer_agency_id  TEXT NOT NULL REFERENCES agency_accounts(id),
  referred_subject    TEXT NOT NULL,               -- 'agency' | 'client'
  referred_id         TEXT NOT NULL,               -- agency_id or workspace_id depending on subject
  source_link         TEXT,
  attributed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rate_basis_points   INT  NOT NULL,               -- 1000 = 10%, 500 = 5%
  status              TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  notes               TEXT
);
CREATE INDEX afr_referrer_idx ON affiliate_referrals (referrer_agency_id);

CREATE TABLE affiliate_payouts (
  id                  TEXT PRIMARY KEY,            -- afp_01HXâ€¦
  agency_id           TEXT NOT NULL REFERENCES agency_accounts(id),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  amount_micros       BIGINT NOT NULL,
  currency            CHAR(3) NOT NULL DEFAULT 'USD',
  paid_at             TIMESTAMPTZ,
  payout_method       TEXT NOT NULL DEFAULT 'paypal',
  payout_reference    TEXT,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paid | failed
  details             JSONB                            -- per-referral breakdown
);
CREATE INDEX afp_agency_period_idx ON affiliate_payouts (agency_id, period_start);
```

### 4.3 IAM / role model

New roles introduced for the agency tier:

| Role | Scope | Permissions |
| --- | --- | --- |
| `agency_owner` | agency_account | Full control: billing, white-label, members, all child workspaces, snapshots. |
| `agency_admin` | agency_account | Like owner but cannot change billing/owner/legal entity. |
| `agency_operator` | agency_account | Read/write across child workspaces (funnels, CRM, integrations). No billing/legal/white-label. |
| `agency_account_manager` | agency_account | Read across all child workspaces, write on a subset assigned via `account_manager_assignments`. |
| `agency_analyst` | agency_account | Read-only across all child workspaces. |
| `client_view` | single workspace (child only) | Sees only their own workspace, branded by agency. Cannot see agency parent, cannot see other clients, cannot see RevTry pool internals. |

RLS:

- Workspace-scoped tables retain the Doc 03 RLS predicate `using (workspace_id = current_setting('app.workspace_id', true))`.
- Agency-scoped tables add a predicate `using (agency_id = current_setting('app.agency_id', true))`.
- For agency users, the API layer sets `app.agency_id` once per session and dynamically sets `app.workspace_id` per request when accessing a child workspace.
- `client_view` users can never escalate `app.agency_id`; the API explicitly strips it.

### 4.4 White-label runtime behavior

- DNS: agency points a CNAME from their chosen domain (e.g., `clients.acmemarketing.com`) to `agencies.funelai.com`. Our edge layer maps the incoming Host header to a `whitelabel_configs` row and serves the appropriate brand assets.
- TLS: managed by us via ACME at the edge; agencies don't need to upload certs.
- Email: agency sets up DKIM and DMARC on a sending subdomain (e.g., `mail.acmemarketing.com`). We provide TXT records; status is reflected in `whitelabel_configs`.
- Outbound transactional emails templating: replace `{{brand_name}}`, `{{brand_logo}}`, `{{primary_color}}`, `{{support_email}}` at render time.
- Outbound SMS branding: SMS body templates respect `{{brand_name}}`; A2P 10DLC registration is per-agency for agency-branded SMS, or per-client where the client owns the brand.
- App UI: a `theme` middleware resolves to the agency theme at request time when `request.host` matches a verified white-label domain. Falls back to FunelAI brand otherwise.

### 4.5 Billing modes

Three billing modes per child workspace, set on creation:

- **`absorbed`** (default for most agencies): client pays the agency directly; the agency's $997/mo seat covers all platform costs. We never bill the client.
- **`passthrough`**: agency uses our Stripe Connect integration; we bill the client a configurable amount (agency keeps remainder); we handle the merchant-of-record duties.
- **`self`** (rare for sub-accounts): client has their own Stripe account on file; useful for some enterprise local businesses.

Pool overages always settle to the agency, never to the client (unless `passthrough` mode is configured to include overages, which is opt-in).

### 4.6 Events emitted (extends Doc 03 PART A)

New events in the `agency` family:

| # | Event | Producer | Required props | Optional | Use case | Retention | PII |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `agency_account_created` | `agency-svc` | `agency_id`, `owner_user_id`, `plan` | `affiliate_code_used` | Billing, growth | 7y | P1 |
| 2 | `subaccount_created` | `agency-svc` | `agency_id`, `workspace_id`, `created_by_user_id`, `billing_mode` | `vertical`, `snapshot_id` | Provisioning, growth | 7y | P1 |
| 3 | `subaccount_archived` | `agency-svc` | `agency_id`, `workspace_id`, `actor_user_id`, `reason` | â€” | Lifecycle | 7y | P1 |
| 4 | `whitelabel_domain_verified` | `agency-svc` | `agency_id`, `domain` | â€” | Onboarding, support | 7y | P1 |
| 5 | `snapshot_created` | `agency-svc` | `agency_id`, `snapshot_id`, `source_funnel_id`, `vertical` | `is_public` | Growth, analytics | 7y | P1 |
| 6 | `snapshot_cloned` | `agency-svc` | `agency_id`, `snapshot_id`, `target_workspace_id`, `resulting_funnel_id`, `cloned_by_user_id` | `overrides_count` | Growth, analytics | 7y | P1 |
| 7 | `pool_consumed` | `revtry-worker` | `agency_id`, `workspace_id`, `resource`, `amount` | `call_id` | Billing, ops | 7y | P1 |
| 8 | `pool_threshold_reached` | `agency-svc` | `agency_id`, `resource`, `threshold_pct` | â€” | Notifications | 7y | P1 |
| 9 | `agency_certified` | `partners-svc` | `agency_id`, `user_id`, `score`, `attempts` | â€” | Growth | 7y | P1 |
| 10 | `partner_directory_lead_referred` | `marketing-svc` | `agency_id`, `prospect_workspace_id?`, `source` | `vertical` | Growth, attribution | 7y | P1 |
| 11 | `affiliate_referral_attributed` | `affiliate-svc` | `referrer_agency_id`, `referred_subject`, `referred_id`, `rate_bp` | `source_link` | Rev-share | 7y | P1 |
| 12 | `affiliate_payout_initiated` | `affiliate-svc` | `agency_id`, `period_start`, `period_end`, `amount_micros`, `currency` | â€” | Finance, audit | 7y | P1 |
| 13 | `affiliate_payout_paid` | `affiliate-svc` | `agency_id`, `payout_id`, `payout_reference` | â€” | Finance | 7y | P1 |

Envelope conforms to Doc 03 Â§A.0.

### 4.7 Caveats / open questions

- **Cross-workspace search:** agency operators need to search "show me every funnel mentioning 'free consultation' across all my clients." This requires a parent-scoped search index. Out of scope for Day-90; tracked in roadmap.
- **Sub-account snapshot ownership on agency churn:** if an agency cancels, what happens to their snapshots? Default: snapshots become immutable for 90 days, then archived. Clients on `absorbed` billing have 30 days to migrate to a different agency or to a `self` plan before workspace suspension; this is codified in the Terms of Service (Doc 05a).
- **Reseller branding on RevTry calls:** the voice agent's identity ("Hi, this is Alex from {{brand_name}}") respects white-label. The call provenance recorded with the carrier (CNAM, A2P brand) is per-client to remain TCPA-correct.

---

## Section 5 â€” Fulfillment Dashboard (Product Spec)

**Purpose:** A single screen the agency owner (or account manager) opens every morning. It is the operational nerve center for 5-50 client sub-accounts.

**Surfaces:** Web only at launch. iOS/Android in fast-follow.

**Default view:** **All clients**, sorted by **health (worst first)**, with the **task queue** in a right-side rail.

### 5.1 Page anatomy

```
+--------------------------------------------------------------------------------+
|  [Agency logo]   Clients   Snapshots   Reports   Pool   Settings         (you) |
+--------------------------------------------------------------------------------+
|  Filter: [All â–¼] [Health â–¼] [Vertical â–¼] [Owner â–¼]     Search: __________      |
|                                                                                |
|  Pool: RevTry 3,128 / 5,000 min used (62%)   â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘  [Manage]           |
|                                                                                |
|  Client                Status  Funnels  Leads  RevTry  Spend  CVR   Health     |
|  Acme Dental           Active  3        47     132m    $1.2k  4.8%  â—         |
|  Bob's HVAC            Active  2        21     58m     $700   2.1%  â—         |
|  Casa Roofing          Pause   1        0      0m      $0     â€”     â—         |
|  Diamond Spa           Active  4        102    412m    $3.4k  6.2%  â—         |
|  â€¦                                                                             |
|                                                                                |
|  [Bulk: Replicate funnel â–¼] [Bulk: Pause campaigns] [Export selected]          |
+--------------------------------------------------------------------------------+
|  Task queue (right rail)                                                       |
|  â€¢ Acme Dental â€” variant B awaiting approval (2d open)              [Open]     |
|  â€¢ Bob's HVAC â€” Meta ad rejected: disclaimer missing                [Open]     |
|  â€¢ Diamond Spa â€” RevTry script change requested by client            [Open]    |
+--------------------------------------------------------------------------------+
```

### 5.2 Client list â€” columns

| Column | Source | Notes |
| --- | --- | --- |
| Client | `workspaces.display_name` | Click â†’ enter sub-account context. |
| Status | `workspaces.status` | onboarding / active / paused / churned. |
| Funnels | count of `funnels` where `deleted_at IS NULL` | Last 90 days unless filter changed. |
| Leads MTD | count of `leads` where `created_at >= start_of_month` | Adjustable to 7d/30d/MTD/QTD. |
| RevTry min | sum from `pool_usage_ledger` MTD | Color codes if approaching workspace cap. |
| Ad spend MTD | from integrations (Meta + Google) | $0 if no ad accounts connected. |
| CVR | leads / funnel sessions MTD | Em-dash if < 50 sessions (low confidence). |
| Health | computed (see 5.4) | Green / yellow / red dot. |
| Next action | `agency_tasks.next_due_at` | "Weekly check-in due Mon" etc. |

Hover on any cell expands a sparkline of the last 8 weeks.

### 5.3 Per-client drill-down (one-click from the list)

When the agency clicks into a client, they enter sub-account context (RLS scope flips). They see:
- **Overview** tab: KPI tiles, leads trend, RevTry trend, spend trend, top funnel.
- **Funnels** tab: list of funnels, status, last edited, performance.
- **Leads** tab: CRM contact list (PII access controlled by role).
- **Ads** tab: connected ad accounts, active campaigns, creative library, fatigue alerts.
- **RevTry** tab: call log, transcripts (if consent banner accepted), script editor.
- **Reports** tab: month-by-month archived white-labeled PDFs.
- **Notes** tab: free-form agency-only notes (not visible to client even in client-view).
- **Settings** tab: branding, domain, billing mode, pool allocation policy, integrations.

A persistent breadcrumb shows "Agency / Acme Dental" so the agency always knows which workspace they're in.

### 5.4 Health score (red / yellow / green)

Computed nightly + on key events. Inputs:

| Signal | Weight | Threshold |
| --- | --- | --- |
| Activation | 25% | Funnel published + first lead received within 14d of onboarding. |
| Lead flow | 25% | Trailing 7d leads â‰¥ 50% of trailing 28d daily average. |
| Engagement (client) | 15% | Client has logged in â‰¥ 1x in last 14 days OR opened last monthly report. |
| Approval freshness | 10% | No tasks awaiting client approval > 5 business days. |
| Pool burn | 10% | Client's RevTry use isn't running ahead of allocation. |
| Spend pacing | 10% | Ad spend within 80-120% of plan. |
| Compliance flags | 5% | No open T&S queue items (see Doc 07b). |

Score buckets: â‰¥0.80 green, 0.60-0.79 yellow, <0.60 red.

Health is descriptive, not prescriptive â€” never auto-pause based on health alone. The dashboard always suggests an action ("Schedule check-in" / "Approve variant" / "Review compliance flag").

### 5.5 Bulk actions

- **Replicate winning funnel:** pick a source funnel (or snapshot), select target clients, system queues a clone job per target with auto-substitution of brand variables. Each clone produces a draft funnel awaiting agency approval before publish.
- **Pause campaigns:** pause all active paid campaigns across selected clients (e.g., during a holiday). Reversible.
- **Send report:** trigger the monthly PDF report for selected clients early or on demand.
- **Export client list:** CSV export with same columns as the on-screen list, plus arbitrary metadata fields.

Bulk actions are rate-limited at 100 clients per minute to protect downstream integrations and to give the agency a chance to abort.

### 5.6 Task queue

Tasks generated automatically when:
- Variant requires client approval (>= 24h since proposed).
- Ad creative rejected by Meta or Google.
- RevTry script change requested via client portal.
- Compliance flag raised by T&S queue.
- Pool utilization > 80% (agency-level task).
- Domain DKIM/DMARC misconfigured > 24h.
- Funnel CTR drops > 20% week-over-week (creative fatigue).
- Monthly report ready for review (1st of month).

Tasks can be assigned to specific agency users, snoozed (up to 7 days), or dismissed with a reason. SLA timers on tasks influence client health score.

### 5.7 Reporting export

The monthly report renders as a white-labeled PDF. Sections:

1. Cover page (agency logo, client name, month).
2. Executive summary (3 sentences auto-written).
3. KPI tiles: leads, conversion rate, ad spend, ROAS, RevTry calls, appointments booked.
4. Funnel performance: each funnel with sessions, leads, CVR, top variant.
5. Voice agent performance: total calls, qualified rate, average call duration, top intent.
6. Compliance posture: open flags (if any), resolved flags this month.
7. Recommendations: 2-3 auto-generated, agency can edit before send.
8. Footer with agency contact + support email.

PDF generation uses our existing template engine; agencies can override sections 1, 2, 7 with custom copy via the dashboard.

### 5.8 Telemetry

Every action emits events to the `agency` family (see 4.6 above). The dashboard itself emits client-side events (`fulfillment_dashboard_viewed`, `bulk_action_initiated`, `client_drilldown_opened`, `task_resolved`) for product analytics.

---

## Section 6 â€” Agency SLA Spec

What we promise every Agency-tier customer, in writing. Customer-facing version lives in the Master Services Agreement Annex A. This section is the operational contract our support and CS teams work to.

### 6.1 Response times (business hours = 8am-6pm Pacific, M-F)

| Severity | Definition | First response | Resolution target |
| --- | --- | --- | --- |
| **P0** | Platform down / cannot publish / data loss / billing block | 1 hour 24Ã—7 | 4 hours |
| **P1** | Major feature broken affecting one or more sub-accounts | 4 business hours | 1 business day |
| **P2** | Minor feature broken, or workaround exists | 1 business day | 5 business days |
| **P3** | Question, request, "how do I" | 1 business day | Best effort |

The headline 4-hour first-response SLA refers to P1; P0 is faster.

### 6.2 Dedicated agency Slack channel

- Every Agency-tier customer is added to a private shared Slack channel with our team within 1 business day of contract signing.
- Channel participants: agency owner + up to 5 of their team; our partnerships lead, customer success manager, product partner (rotating), on-call eng (lurking).
- Slack is the **support escalation channel**, not the support intake channel â€” formal tickets still flow through the in-app help center for tracking. Slack is for "hey we have a thing" warm escalation.

### 6.3 Account management coverage

| Tier | AM coverage |
| --- | --- |
| Scale | Shared AM (1 AM per ~40 customers) |
| Agency | Dedicated AM (1 AM per ~15 customers) |
| Enterprise | Dedicated AM + technical contact |

The dedicated AM is named, introduced on the kickoff call, available in the Slack channel, and runs the QBR cadence below.

### 6.4 Quarterly business reviews (QBRs)

- Cadence: every 90 days, scheduled in advance.
- Duration: 60 minutes.
- Format: Zoom, recorded with consent.
- Participants: agency owner + agency leads; our AM + a product partner (rotating).
- Agenda template:
  1. Agency KPIs (clients onboarded, churn, total leads delivered, pool utilization).
  2. Wins (top-performing client funnels, awards submissions).
  3. Pain points (open tickets, requested features).
  4. Roadmap preview (what's shipping next quarter the agency cares about).
  5. Expansion conversation (new verticals, more sub-accounts, partnership upgrades).
- Output: action items doc, owned 50/50 by our AM and the agency.

### 6.5 Beta feature access

- Certified agencies are added to the beta cohort by default.
- New features land in beta 2-6 weeks before GA.
- Beta releases include: release notes, opt-in toggle, dedicated feedback channel in the agency Slack, weekly office hours with PM during beta period.
- Bugs found in beta are not counted against our P1/P2 SLAs; they're handled in a separate beta-bug track with best-effort response.

### 6.6 KB pack early access

- New industry KB packs ship to the certified-agency cohort one full quarter before general release.
- Agencies in the relevant vertical specialization (per directory listing) get a heads-up email 30 days before that.
- This is the most-cited reason agencies pursue certification: KB-pack early access is genuine competitive advantage.

### 6.7 Credits & remedies

If we miss an SLA:

| Missed SLA | Credit |
| --- | --- |
| P0 first response | 5% of monthly fee per incident |
| P0 resolution | 10% of monthly fee per incident |
| P1 first response | 2% of monthly fee per incident |
| P1 resolution | 5% of monthly fee per incident |
| Lower severities | No automatic credit; case-by-case via AM |

Credits cap at 50% of one monthly fee per calendar month. Credits do not roll over.

### 6.8 What we don't promise

- We don't promise specific lead volumes for any client. That's between the agency and the client.
- We don't promise that every ad approved by us will be approved by Meta/Google.
- We don't act as the agency's legal compliance reviewer. We provide tooling; the agency owns the use.
- We don't operate the agency's clients. Agency owns the client relationship.

---

## Section 7 â€” Marketing Assets for Agencies

All assets are white-labeled and editable. Master files live in the in-app **Resources** library, exported to Figma + Google Slides + Canva templates.

### 7.1 Co-branded landing page templates (3 variants)

Hosted templates the agency can clone into a sub-account and rebrand. Variant breakdown:

**Variant A â€” "The Lead-Gen Promise"** (best for cold traffic from paid social)
- Hero: "Get [N] qualified [vertical] leads in the next 30 days â€” or we work for free."
- Three trust badges: "Meta Business Partner â€¢ Google Premier â€¢ FunelAI Certified."
- Mid-page: 60-second product video (auto-embed of the agency's recorded walkthrough).
- Lower fold: 3 client case-study tiles.
- CTA: free strategy call.

**Variant B â€” "The Authority Build"** (best for warm referrals and content)
- Hero: founder photo + "We've built [N] funnels for [vertical] businesses. Here's what we learned."
- Mid-page: long-form authority content + lead magnet (ungated or email-gated).
- Lower fold: testimonials with photo + name.
- CTA: download the playbook â†’ email opt-in.

**Variant C â€” "The Speed Pitch"** (best for retargeting and email)
- Hero: "60 seconds. Your full marketing funnel built for you."
- Mid-page: 90-second screencast of a funnel being generated.
- Lower fold: pricing table (agency's three packages from Module 4 of the cert).
- CTA: book the demo.

Each variant ships with a complementary thank-you page and confirmation-email template.

### 7.2 Email templates for client outreach (5)

Sender: agency. Subject lines and 1-sentence summaries:

1. **"Quick question about [client]'s marketing"** â€” cold introduction, references something specific about the prospect's business.
2. **"I built a sample funnel for [client] â€” want to see it?"** â€” value-first, attaches a 30-second video walkthrough of a funnel auto-generated for the prospect's URL.
3. **"Re: our chat â€” sending the proposal"** â€” post-discovery follow-up with proposal link and a clear next step.
4. **"3 things [vertical] businesses are getting wrong in 2026"** â€” nurture email pointing to a relevant case study or playbook.
5. **"Last check-in â€” should I close out the file?"** â€” break-up email, surprisingly high open and reply rates.

Templates ship as plain HTML + plaintext + .eml import + native templates for Gmail/Outlook/HubSpot.

### 7.3 Social posts ready to publish (10)

Each is a single image + caption + 5 hashtags, sized for both LinkedIn and Instagram. Topics:

1. "Here's what a [vertical] funnel looks like in 2026" â€” annotated screenshot.
2. "We just delivered [client] their 100th lead in 30 days" â€” single big number.
3. "The 60-second test" â€” short video clip of a funnel being generated.
4. "Three things I'd never put in a [vertical] ad" â€” carousel.
5. "Behind the scenes â€” how we run 30 clients with 3 people" â€” team photo + workflow.
6. "[Client] won a FunelAI Award this quarter" â€” agency credit, builds social proof.
7. "Compliance fundamentals every [vertical] should know" â€” educational.
8. "Hot take â€” most [vertical] marketing in 2026 is broken becauseâ€¦" â€” opinion.
9. "Our biggest mistake last quarter and what we learned" â€” vulnerability + lesson.
10. "DM us a URL and we'll build you a funnel â€” free" â€” value-bait, drives conversations.

Posts come pre-written; agency owner replaces the bracketed variables and posts.

### 7.4 Video demos to embed

- 90-second product walkthrough (agency-recorded, with co-brand template overlay).
- 3-minute "behind the funnel" client testimonial (the agency interviews a happy client; we provide the question framework).
- 5-minute deep-dive walkthrough (agency's strategic positioning).

Hosted on Wistia (we provide the agency a sub-channel); auto-embeds with the agency's logo as the play button.

### 7.5 Case study framework

One-page template per client win. Sections:

- Client: name, vertical, geography (or anonymized if needed).
- Before: previous marketing situation in 2 sentences.
- Approach: what the agency did in 3 bullets.
- Result: KPIs (leads, conversion, ROI) â€” with timeframe.
- Quote: 1-2 sentence client testimonial.
- Visuals: a screenshot of the funnel + a chart.
- CTA: "Want results like this? Book a call."

Template renders as both a one-page PDF (agency print/email) and a web page on the agency's site (provided as a snippet they can embed). Ships with a fill-in workflow in the dashboard â€” the agency picks a client, the system pre-fills KPIs from actuals, the agency writes the narrative and exports.

### 7.6 Cold outreach email templates (5)

Sender: agency. Use case: outbound prospecting to local businesses in a chosen vertical and geography. Each template includes subject + body + 2 follow-up emails (so really 15 emails total). Same compliance posture as Section 7.2 â€” CAN-SPAM compliant, includes physical address + unsubscribe.

Topics:
1. **Generic value-first** â€” "I noticed [specific thing] about [business]. Quick idea."
2. **Competitive intel** â€” "Your competitor [X] is running these ads. Here's how I'd respond."
3. **Local landmark / news** â€” references a specific local event/news item for warmth.
4. **Loom video** â€” 90-second personal video, embedded thumbnail in email.
5. **Direct offer** â€” "Free funnel audit, 30 mins, no pitch."

Best opener-to-meeting rate in our agency cohort data: #4 (Loom video), at ~3.2% reply-to-meeting conversion.

---

## Section 8 â€” Agency Revenue Share Program

The viral kicker. Designed to make FunelAI the obvious referral for every agency-shaped network â€” masterminds, conferences, Slack communities, podcasts.

### 8.1 The two earnings paths

**Path 1 â€” Agency-to-agency referral**
- An agency on FunelAI (the referrer) refers another agency to the platform.
- If the referred agency signs up via the referrer's unique affiliate link and pays for at least one month, the referrer earns **10% of the referred agency's monthly subscription, recurring for the lifetime of that subscription**.
- Example: referrer brings in 4 agencies on the $997 tier. Recurring monthly earning: 4 Ã— $997 Ã— 10% = $398.80/mo, paid every month indefinitely while the referred agencies remain customers.

**Path 2 â€” Client-to-direct-customer conversion**
- An agency's client (a local business) decides they want to manage FunelAI directly rather than through the agency. We accommodate this â€” they convert from a sub-account into a standalone Workspace, with their data intact.
- The originating agency earns **5% of that converted client's standalone subscription, recurring for the lifetime of the subscription**.
- This protects the agency from feeling cannibalized when a client "graduates" off them. Practically, this is rare (most local businesses do not want to operate the platform), but the program removes the perverse incentive to block the conversion.

### 8.2 Attribution mechanics

- Every Agency-tier customer is issued a unique `affiliate_code` on signup (stored on `agency_accounts.affiliate_code`).
- The agency's affiliate link is `funelai.com/r/<affiliate_code>` and a deep-link UTM variant for tracking provenance.
- Attribution window for path 1 (agency-to-agency): 60 days from first click. Last-click attribution.
- Attribution window for path 2 (client-to-direct): unlimited â€” if the client's standalone workspace was ever a sub-account under the agency, the agency is permanently credited.
- Self-referral is blocked (cannot earn share on workspaces under your own agency).
- Affiliates of affiliates: not a multi-level program. We pay one hop only.

### 8.3 Payouts

- **Cadence:** monthly, in arrears. Earned in month N, paid in month N+1 (between the 5th and the 15th).
- **Method:** PayPal (primary). Wise or ACH on request. International supported via PayPal where available.
- **Minimum:** $25 per payout. Balances below $25 roll forward.
- **Statement:** every payout includes a PDF statement showing per-referral breakdown (which referred customer, base amount, rate, share).
- **Currency:** USD. International payouts converted by PayPal at their daily rate.

### 8.4 Eligibility and revocation

- Earnings begin once the referred customer's first invoice is paid in full (no earning on trial-only signups).
- If the referred customer refunds within the refund window (Doc 05d), the corresponding earning is reversed.
- If the referred customer cancels, earnings cease for future months but past earned amounts are not clawed back.
- The referrer must remain in good standing (active subscription, no T&S violations, no fraud flags) to earn.
- Suspected fraudulent attribution (fake signups, paid-for click farms, brand-name SEO squatting on "FunelAI" in violation of our marks policy) results in immediate forfeit of pending and future earnings, plus possible account suspension.

### 8.5 Program reporting

In the Agency dashboard â†’ **Revenue Share** tab:

- Lifetime earnings: total earned to date.
- This month: accrued earnings for the current month.
- Active referrals: list of agency- and client-referrals currently earning, with per-row monthly amount.
- Conversion funnel: clicks â†’ trials â†’ paid customers, with conversion rates per source link variant.
- Payout history: each prior payout with date, amount, statement PDF.

### 8.6 Co-marketing accelerator (additive)

For agencies that drive material referral volume (5+ active agency referrals or 25+ active client conversions), we offer:

- Co-marketing budget (paid social, conference sponsorships, podcast spots).
- Joint webinars to the FunelAI customer base.
- "FunelAI Featured Partner" badge in the directory with priority placement.
- Direct line to our partnerships VP.

Enrollment is invite-only and reviewed quarterly.

---

## Appendix A â€” Glossary

| Term | Definition |
| --- | --- |
| **Agency account** | The parent entity owned by the agency, holding billing, white-label, snapshots, and pool resources. |
| **Sub-account / child workspace** | A workspace created under an agency account, representing one of the agency's clients. |
| **White-label** | The full visual + sender + support replacement of FunelAI branding with the agency's branding across all client-facing surfaces. |
| **Pool** | A monthly resource allotment (currently RevTry minutes) shared across an agency's sub-accounts. |
| **Snapshot** | A saved funnel template owned by the agency, clonable into any sub-account with brand variables auto-substituted. |
| **KB pack** | A vertical-specific knowledge base shipped with FunelAI, containing offers, scripts, compliance rules, and CPL benchmarks. |
| **RevTry** | Our AI voice agent that calls leads within ~60 seconds of conversion. |
| **Health score** | Composite 0-1 score per sub-account indicating activation, lead flow, engagement, and compliance posture. |
| **FunelAI Awards** | Quarterly recognition program for top-performing client funnels; submitted by agencies. |
| **Affiliate code** | Unique short string per agency used to attribute referral revenue. |
| **Passthrough billing** | Billing mode where FunelAI bills the client directly on the agency's behalf via Stripe Connect. |
| **Absorbed billing** | Billing mode where the agency bills the client and FunelAI bills only the agency. |
| **Client-view role** | A workspace role giving a client login access to only their own workspace, branded by the agency. |
| **Partner Directory** | Our public-facing list of certified agencies at `funelai.com/partners`, with vertical and geographic filters. |

---

## Appendix B â€” Change log

| Date | Author | Change |
| --- | --- | --- |
| 2026-05-25 | Partnerships + Product + Eng | Initial canonical version. Shipped with Day-90 Agency tier launch. |
