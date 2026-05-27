# 06a â€” Customer Success & Activation Framework

**Document owner:** VP Customer Success
**Status:** v1.0 â€” Day 90 launch
**Audience:** CS team, Product, Engineering, Founder
**Related docs:** 03 Event Taxonomy, 04 Notification Engine Spec, 05 Pricing & Packaging, 06b Crisis Comms Library
**Last updated:** Day 75 of launch runway

---

## 1. North Star Metric

> **Time from signup to first qualified lead, measured in days, p50 (median) across the rolling 30-day signup cohort, target < 14 days.**

A user is **Activated** when ALL of the following events have fired for their account:

| Required Event | Definition | Canonical event name |
|---|---|---|
| Funnel live | At least one funnel in `status=published` with a public URL returning 200 | `funnel.published` |
| Traffic source connected | At least one of: ad account OAuth complete, custom domain DNS verified, social account connected | `traffic_source.connected` |
| Lead captured | At least one inbound lead row written to `leads` table from a published funnel | `lead.captured` |
| First follow-up completed | RevTry call, SMS, or email outbound event recorded with `status in (completed, delivered, talked)` | `followup.completed` |

Activation flag is computed server-side as `users.activated_at = MIN(timestamp where all four events satisfied)`.
This is the single source of truth â€” do not recompute in dashboards from event streams.

### Secondary metrics

- **Activation rate D14**: % of signup cohort activated within 14 days. Target: 55% at GA, 65% by Day 180.
- **Time-to-traffic-source (TTTS)**: median hours from signup to `traffic_source.connected`. Target: < 36 hours.
- **Time-to-first-lead (TTFL)**: median days from `funnel.published` to `lead.captured`. Target: < 5 days.
- **D7 retention** (logged in OR funnel-edited on day 7-8): target 60% of signups, 80% of activated users.
- **Paid conversion D14**: % of free-tier signups on paid plan by D14. Target 18% at GA.

---

## 2. The Success Path â€” In-Product Checklist

Always-visible in the dashboard right sidebar (collapsible after activation). Each step has its own celebration micro-interaction.

```
â”Œâ”€ Your Success Path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  [x] Signed up                                  â”‚
â”‚  [ ] First funnel generated         [Start â†’]   â”‚
â”‚  [ ] Ad account OR domain connected [Connect â†’] â”‚
â”‚  [ ] First ad/post published OR     [Publish â†’] â”‚
â”‚      domain live                                â”‚
â”‚  [ ] First lead captured            [pending]   â”‚
â”‚  [ ] First RevTry follow-up         [pending]   â”‚
â”‚      completed                                  â”‚
â”‚                                                 â”‚
â”‚  Progress: â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘  3 of 6 (50%)         â”‚
â”‚  Estimated time to first lead: 6 days           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Step-by-step behavior

| Step | Trigger event | Celebration | CTA copy if incomplete | Help link |
|---|---|---|---|---|
| Signed up | `user.signed_up` | Confetti + "Welcome to FunelAI" toast | (done) | â€” |
| First funnel generated | `funnel.created` | "Your funnel is ready" + thumbnail | "Generate your first funnel in 90 seconds" | `/learn/first-funnel` |
| Source connected | `traffic_source.connected` | "Connected!" + green badge on source | "Plug in traffic â€” pick one" | `/learn/connect-source` |
| Published | `funnel.published` OR `ad.launched` | Fireworks animation + share button | "You're one click from going live" | `/learn/publish` |
| Lead captured | `lead.captured` | Big confetti + push notification | (pending â€” locked until publish) | `/learn/leads` |
| Follow-up done | `followup.completed` | Trophy + "You're officially Activated" full-screen modal | (pending) | `/learn/revtry` |

**Design rules:**
- Estimated-time label updates dynamically from cohort medians for the user's industry vertical.
- After full activation, the checklist collapses to a "FunelAI Awards: Bronze unlocked" banner with the referral CTA.
- The checklist must persist across sessions â€” never auto-dismiss until activated.
- Users can opt out via `/settings/coaching` (sets `users.coaching_opt_out=true`) â€” checklist hides, all intervention emails stop, but the activation flag still computes.

---

## 3. Daily Intervention Triggers (Automated)

All triggers are emitted by the **Lifecycle Orchestrator** service, which subscribes to the canonical event stream and writes to the Notification Engine (see Engineering Spec, Section 7). Time references are user-local where known, else account-creation timezone, else UTC.

### Day 0 â€” Signup day

| Trigger | Channel | Sender | Send window | Bypass conditions |
|---|---|---|---|---|
| Welcome email + 90-sec demo video | Email | `hello@funelai.com` (CS rep persona) | Within 60 sec of `user.signed_up` | Never |
| In-app "Generate your first funnel" full-screen takeover | In-app | System | On first dashboard load | `funnel.created` already fired |
| If Scale/Agency tier signup â†’ Slack ping to #cs-vip with founder mention | Internal | â€” | Within 5 min | â€” |

### Day 1 â€” First nudge

| Trigger | Channel | Sender | Send window |
|---|---|---|---|
| In-app tooltip walk-through: ad account connection (interactive, 4 steps) | In-app | System | On second login of Day 1 |
| Email reminder "Connect a traffic source â€” 2-minute setup" | Email | CS rep | 24h after signup, 9am-11am user-local |
| Skip if | `traffic_source.connected` already fired | | |

### Day 2 â€” Traffic source still missing

| Condition | Trigger | Channel | Sender |
|---|---|---|---|
| No `traffic_source.connected` by hour 36 | SMS from RevTry: "Hey [name], this is RevTry from FunelAI. Need help launching your first ads? Reply YES and I'll call within 5 minutes." | SMS | RevTry voice agent number |
| User replies YES | RevTry initiates outbound call within 5 min, walks user through OAuth on a screen-share link | Voice | RevTry |
| User replies STOP / opts out | All RevTry SMS suppressed for account | â€” | â€” |

### Day 3 â€” No lead captured yet

| Condition | Trigger | Channel | Sender |
|---|---|---|---|
| No `lead.captured` by Day 3, 10am user-local | Personal email from founder: "I noticed you got your funnel live but haven't seen a lead come in yet. Want to jump on a free 15-min funnel tune-up? Pick a time â†’ [Calendly link]" | Email | Founder, plaintext, no marketing chrome |

### Day 4 â€” Community pull-in

| Trigger | Channel | Sender | Content |
|---|---|---|---|
| Community invite | Email + in-app banner | CS rep | "Other [industry] businesses are sharing wins in the FunelAI Community. See what's working." Deep link to industry-specific Circle/Slack channel. |

### Day 5 â€” Concierge escalation

| Condition | Trigger | Owner |
|---|---|---|
| No `lead.captured` by Day 5 noon user-local | Auto-create task in CS tool, assign to on-duty CS rep. Required outbound call within 4 business hours. Founder personally calls if Scale/Agency tier. | CS rep or founder |

Concierge call SLA: dial within 4h. If no answer, voicemail + email + retry next business day. Maximum 3 attempts over 5 business days.

### Day 7 â€” Activated path / Not-activated path

| Branch | Trigger |
|---|---|
| **Activated** | Trigger FunelAI Awards **Bronze** tracker (badge unlocks on profile, shareable card auto-generated). In-app modal asks for referral with 2-click invite. Email follow-up with referral incentive ($25 credit per converted referral). |
| **Not activated** | "Save" offer: extend 7-Day Pro Boost by 7 additional days + offer personal funnel audit. Email from founder, subject: "Let's get you a win in week 2." Audit booking link to founder's Calendly. |

### Day 14 â€” Decision point

| Branch | Trigger |
|---|---|
| **Activated, free tier** | Upgrade ask: in-app modal showing top features they're missing on free + 20%-off-first-month code, expires 72h. Email backup. |
| **Activated, paid tier** | Cross-sell: RevTry minute pack + Awards Silver milestone. |
| **Not activated** | Final outreach call from CS lead. If user has logged in past 5 days â†’ exit survey email ("Help us understand"). If user dormant 7+ days â†’ reactivation pause sequence (no more emails for 14d, then one re-engagement). |

### Trigger override matrix

| Account state | Effect on triggers |
|---|---|
| `coaching_opt_out=true` | Skip all email/SMS lifecycle triggers. In-app checklist hides. Concierge calls only if user requests. |
| `revtry_sms_opt_out=true` | Skip Day 2 SMS. Substitute with email. |
| Refund issued | Cease all sequences immediately. |
| Tier downgrade to free | Restart Day 0 sequence on the downgrade date, branded as "fresh start." |
| Reactivation after dormancy | Re-enter sequence at Day 0 with new welcome variant. |

---

## 4. Cohort Tracking

Daily cohort = all `user.signed_up` events within a 24h UTC window. Cohorts are tracked for 90 days. Dashboard lives at `/admin/cohorts`.

### Required cohort metrics

| Metric | Definition | Display |
|---|---|---|
| **% connecting source by D2** | Of cohort N, fraction with `traffic_source.connected` within 48h | Line chart over time, with industry breakdown |
| **% first lead by D7** | Of cohort N, fraction with `lead.captured` within 168h | Line chart, with traffic-source-type breakdown (paid ads / organic / domain) |
| **% paid upgrade by D14** | Of cohort N, fraction with `subscription.upgraded` from freeâ†’paid within 14d | Line chart, segmented by tier reached |
| **Activation rate D14** | Of cohort N, fraction with `users.activated_at` within 14d | Headline number |
| **D30 retention** | Of cohort N, fraction with any session activity D29-D30 | Line chart |

### Slicing dimensions

- Industry vertical (30 industries)
- Signup source (organic / paid / referral / partner)
- Tier at signup (free / Pro Boost / paid)
- Geography (country, US state)
- Self-reported business size (solo / SMB / agency)

### Cohort dashboard requirements

- Side-by-side comparison of any two cohorts.
- Funnel visualization: signup â†’ funnel.created â†’ source.connected â†’ published â†’ lead.captured â†’ followup.completed.
- "Health" indicator: red if any cohort falls > 15% below trailing-30-day baseline on any step.
- Export to CSV.
- Slack digest every Monday 9am Pacific to #cs-leadership.

---

## 5. Drop-off Correlation & Weekly Leak Flag

### Methodology

For each step in the activation funnel, compute:

1. **Step completion rate** for the cohort
2. **Conditional D30 retention** given the user reached that step
3. **Î” retention** = D30 retention | reached step âˆ’ D30 retention | reached prior step

The step with the largest Î” retention is, in practice, the step that most strongly predicts retention. That step is "where the leverage is."

### Auto-flag job

Runs every Monday 6am Pacific:

1. Pull last 4 weeks of cohorts.
2. For each step, compute conversion rate and Î” retention.
3. Identify the step with the largest absolute drop-off rate AND the step with the largest Î” retention contribution.
4. If either has worsened > 5 percentage points vs trailing 4-week median, post to #cs-leadership and #product-leadership with:
   - Step name and severity
   - Cohorts affected
   - Industry breakdown
   - Suggested owner (Product if step is in-product, CS if step is education, Eng if step is technical/OAuth)

### Sample biggest-leak playbook (historical, replace once we have data)

| Leak | Hypothesis | First-pass fix | Owner |
|---|---|---|---|
| Funnel created â†’ source connected | OAuth friction, especially Meta | Inline preview of OAuth flow + RevTry SMS Day 2 | Product + CS |
| Source connected â†’ published | Users don't know to publish | Auto-suggest publish after source connected | Product |
| Published â†’ lead captured | No traffic running | Day 3 founder email + ad budget primer | CS |
| Lead captured â†’ follow-up | Don't trust voice agent | Sample call audio in onboarding | Product + CS |

---

## 6. Concierge Playbook

### When the founder personally steps in

- Scale-tier ($497/mo) or Agency-tier ($997/mo) signups: founder calls within first 5 days regardless of activation state.
- Any account in `coaching_opt_out=false` that hits Day 5 without lead AND has > $5k LTV indicator (firmographic).
- Any account that posts a complaint in community or social with > 100 impressions.
- Any account that triggers a MAJOR or CRITICAL incident touchpoint (see 06b).

### Outreach call script â€” Day 5 concierge (CS rep version)

> "Hi [name], this is [CS rep] from FunelAI. I'm not calling to sell you anything â€” I noticed you got your funnel published but no leads have come in yet, and I want to figure out why with you. Do you have 10 minutes right now or should I call back?
>
> [If yes] Great â€” pull up your dashboard with me. Let's look at three things: where your traffic is coming from, what your funnel looks like to a visitor, and whether RevTry has the right phone number to call from. Sound good?
>
> [Diagnostic loop â€” see scoresheet below]
>
> Before we hang up â€” what's the one thing that, if FunelAI did it for you in the next 7 days, would make this a no-brainer to keep using?"

### Outreach call script â€” Day 5 concierge (founder version, Scale/Agency)

> "[name], it's [founder] from FunelAI. I personally watch every Scale and Agency account in their first week, and you're on Day 5 without a lead. I want to spend 20 minutes with you, on me, to fix whatever's in the way. Are you good to share screens right now or would [tomorrow morning] work?"

### Diagnostic scoresheet (filled in on every concierge call)

| Dimension | Question | Red flag |
|---|---|---|
| Traffic | Is the source actually sending visitors? | < 50 sessions in 72h after publish |
| Targeting | Is the audience right for the offer? | Industry mismatch |
| Funnel quality | Would you opt in to this yourself? | Generic copy, missing CTA, broken images |
| Offer | Is the value clear in 5 seconds? | Lead magnet weak or unclear |
| RevTry config | Is the calling number set, hours configured, script reviewed? | Defaults still in place |
| Expectations | Does the user expect leads in days, hours, or weeks? | Mismatch = churn risk |

Required output of every concierge call: filled scoresheet logged to CRM, NPS-style prompt at end of call, action items emailed within 1 hour.

### Email templates

Templates are stored as named blocks in the lifecycle service. Each has variables `{first_name}`, `{industry}`, `{funnel_url}`, `{cs_rep}`.

**TEMPLATE: welcome_d0** â€” Day 0 welcome

> Subject: Welcome to FunelAI â€” your first funnel is 90 seconds away
>
> Hey {first_name},
>
> Welcome in. I'm {cs_rep} and I'll be in your corner during your first 14 days.
>
> Here's a 90-second video showing how to get your first funnel live, connected to traffic, and capturing leads: [video link]
>
> One thing most {industry} businesses get wrong: they over-think the funnel and under-invest the traffic. Don't do that. Pick the AI-generated funnel, publish it, and let's get visitors on it today.
>
> Reply directly to this email if you want to talk to a human. I read every reply.
>
> â€” {cs_rep}, FunelAI

**TEMPLATE: source_reminder_d1** â€” Day 1 source connection nudge

> Subject: One thing left before your funnel starts working
>
> {first_name} â€” your funnel looks great, but it's not getting any traffic yet because no ad account or domain is connected.
>
> Two-minute fix: [connect ad account] or [point a custom domain].
>
> If you'd rather have us do it for you, hit reply with "do it for me" and a CS rep will set it up live.
>
> â€” {cs_rep}

**TEMPLATE: founder_d3** â€” Day 3 founder personal

> Subject: noticed you haven't seen a lead yet
>
> {first_name},
>
> {founder_first_name} here, founder of FunelAI. I look at every account on Day 3 that doesn't have a lead yet â€” that's where you are.
>
> 15 minutes on me, you and me, screen share, no pitch: [calendly link]
>
> If now's not the time, just hit reply and tell me what's in the way. I read every one.
>
> â€” {founder_first_name}

**TEMPLATE: save_offer_d7** â€” Day 7 not-activated save

> Subject: Extending your Pro Boost â€” let's get you a win in week 2
>
> {first_name},
>
> I'm extending your 7-Day Pro Boost by another 7 days, no charge, no catch. You'll keep every Pro feature through {boost_end_date}.
>
> In exchange, give me 20 minutes for a personal funnel audit this week: [calendly link]
>
> Some of our best customers needed two weeks to find their groove. Let's make sure you're one of them.
>
> â€” {cs_rep}

**TEMPLATE: upgrade_ask_d14** â€” Day 14 activated upgrade

> Subject: You're activated. Time to scale.
>
> {first_name} â€” you got your first lead in {days_to_first_lead} days. That's faster than {percentile}% of {industry} businesses on FunelAI.
>
> Here's what changes if you upgrade to {recommended_tier} this week:
> - {tier_benefit_1}
> - {tier_benefit_2}
> - {tier_benefit_3}
>
> 20% off your first month with code WIN20, valid until {expiry}: [upgrade link]
>
> â€” {cs_rep}

**TEMPLATE: exit_survey_d14** â€” Day 14 not-activated exit

> Subject: Before you go â€” one question
>
> {first_name},
>
> Looks like FunelAI isn't clicking for you yet. Before we stop sending you emails â€” what was the one thing missing that would have made this work?
>
> Just hit reply with one sentence. I'll personally read it.
>
> â€” {founder_first_name}

### Escalation path

```
Tier 0 â€” Automated:           Lifecycle emails, in-app, RevTry SMS
        â†“ (no resolution in 48h)
Tier 1 â€” CS rep:              Personal email, scheduled call
        â†“ (Scale/Agency tier OR public complaint OR > $5k LTV)
Tier 2 â€” CS lead:             Skip-level outreach, audit included
        â†“ (incident OR press exposure OR > $25k ARR at risk)
Tier 3 â€” Founder:             Direct call, personal commitment, deal-saving authority
        â†“ (legal / regulatory dimension)
Tier 4 â€” Founder + Legal:     See 06b Crisis Comms Library
```

---

## 7. Engineering Spec

### Events that drive the system

All lifecycle triggers consume the **canonical event taxonomy** (Doc 03). The relevant subset:

| Event | Schema fields | Lifecycle role |
|---|---|---|
| `user.signed_up` | user_id, email, plan_at_signup, signup_source, industry, ts | Cohort assignment, Day 0 triggers |
| `funnel.created` | user_id, funnel_id, template_id, generation_method, ts | Step 2 of Success Path |
| `traffic_source.connected` | user_id, source_type, source_id, ts | Step 3, suppresses Day 2 SMS |
| `funnel.published` | user_id, funnel_id, public_url, ts | Step 4 |
| `ad.launched` | user_id, funnel_id, ad_platform, ad_account_id, budget, ts | Step 4 (alternate) |
| `lead.captured` | user_id, funnel_id, lead_id, source, ts | Step 5, suppresses Day 3 founder email |
| `followup.completed` | user_id, lead_id, channel, outcome, ts | Step 6, triggers activation |
| `revtry.sms_sent` / `revtry.call_completed` | user_id, lead_id, status, ts | Tracks RevTry hand-off |
| `subscription.upgraded` / `subscription.downgraded` | user_id, from_plan, to_plan, ts | Day 14 branching |
| `user.opted_out` | user_id, channel, ts | Suppression rules |

Source of truth: 03-event-taxonomy.md. Lifecycle Orchestrator MUST consume from the same Kafka/Kinesis stream as analytics â€” no separate event pipeline.

### Lifecycle Orchestrator service

- **Language/runtime:** Node.js (matches main app)
- **State store:** Postgres `lifecycle_user_state` table â€” one row per user with cached step flags and next-trigger timestamps
- **Scheduler:** Postgres-backed cron (pg-boss) for time-of-day triggers; event-driven for state changes
- **Output:** writes to Notification Engine queue (one message per trigger), never sends directly

Schema sketch:

```sql
CREATE TABLE lifecycle_user_state (
  user_id            UUID PRIMARY KEY,
  signed_up_at       TIMESTAMPTZ NOT NULL,
  industry           TEXT,
  plan_tier          TEXT,
  funnel_created_at  TIMESTAMPTZ,
  source_connected_at TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  first_lead_at      TIMESTAMPTZ,
  first_followup_at  TIMESTAMPTZ,
  activated_at       TIMESTAMPTZ,
  coaching_opt_out   BOOLEAN DEFAULT FALSE,
  revtry_sms_opt_out BOOLEAN DEFAULT FALSE,
  email_opt_out      BOOLEAN DEFAULT FALSE,
  last_triggered_step TEXT,
  next_trigger_at    TIMESTAMPTZ,
  next_trigger_kind  TEXT,
  updated_at         TIMESTAMPTZ DEFAULT now()
);
```

### Notification Engine integration

The Notification Engine (Doc 04) accepts messages of shape:

```json
{
  "user_id": "uuid",
  "template_id": "welcome_d0",
  "channel": "email | sms | in_app | call_task",
  "sender_persona": "cs_rep | founder | system | revtry",
  "variables": { "first_name": "...", "industry": "...", "...": "..." },
  "send_at": "ISO8601",
  "suppress_if": ["funnel.published", "..."],
  "dedupe_key": "user_id:template_id:cohort_day"
}
```

The Notification Engine handles:
- Per-channel opt-out enforcement (one source of truth for `email_opt_out`, `sms_opt_out`, etc.)
- Throttling (max 1 email/24h, max 1 SMS/72h, max 1 in-app modal/session)
- Quiet hours (no SMS or call before 8am or after 9pm user-local)
- Final consent check (do not send if `user.deleted_at IS NOT NULL`)
- Delivery tracking (writes back to event stream as `notification.sent`, `notification.opened`, `notification.clicked`)

### Opt-out

Three levels, all settable from `/settings/coaching`:

1. **Coaching opt-out**: Hides Success Path checklist, stops all lifecycle emails/SMS. Concierge outreach only on user-initiated tickets.
2. **Per-channel opt-out**: Email, SMS, in-app, push individually.
3. **Persona opt-out**: Block specific sender personas (e.g., founder-persona emails) â€” useful for users who find founder-direct-touch performative.

All opt-outs are honored within 60 seconds of toggle. Anything already in the notification queue past the dispatch threshold is sent â€” there is a clear UX note about this on the settings page.

### Idempotency, observability, and failure modes

- Every trigger has a `dedupe_key` of `(user_id, template_id, cohort_day)`. Notification Engine enforces single-send within that key for 30 days.
- Every state transition emits a `lifecycle.transition` event for analytics replay.
- Dashboards required: trigger send rate, trigger suppression rate (by reason), per-template open/click rate, per-template downstream activation lift.
- If Lifecycle Orchestrator falls behind by > 30 min, page on-call.
- If Notification Engine queue depth > 10k, page on-call.

---

## 8. Operating Rhythm

| Cadence | Meeting | Attendees | Inputs |
|---|---|---|---|
| Daily 9am PT | CS standup | CS team | New signups overnight, escalations, concierge call schedule |
| Weekly Monday | Cohort review | CS lead, Product, Founder | Cohort dashboard, leak auto-flag |
| Weekly Wednesday | Concierge calls block | CS leads + founder | Day 5 / Day 7 outreach lists |
| Monthly | Activation framework review | CS + Product + Eng | Trigger performance, opt-out trends, template revisions |
| Quarterly | North Star recalibration | Exec team | Whether < 14 days median is still the right target |

---

## 9. Appendix: Industry-specific overlays

Each of the 30 industries has a small overlay file: which lead magnet template to default to, average TTFL benchmark, common OAuth friction points, RevTry script tweaks. Stored under `/industry-overlays/{slug}.yaml`. Not reproduced here.
