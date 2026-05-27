# 06b â€” Crisis Communications Library

**Document owner:** Head of Trust & Safety / Founder (jointly)
**Status:** v1.0 â€” Day 90 launch
**Audience:** CS, Legal, Eng on-call, Founder, External counsel
**Related docs:** 06a Activation Framework, 07 Incident Response Runbook, 08 Data Handling & Privacy Policy
**Review cadence:** Quarterly, plus after every CRITICAL incident

---

## 0. How to use this document

1. **Identify the scenario class** (Section 3). Ten classes are pre-defined; if a real incident doesn't fit, use the closest fit and edit the template.
2. **Classify severity** (Section 1). When in doubt, classify UP.
3. **Pull the template** (Section 3, scenario Ã— severity). Treat it as a starting draft, not finished copy. Names, numbers, dates, and apology specifics must be filled in by the on-call comms owner.
4. **Route for approval** at the level marked in the template header.
5. **For any CRITICAL incident**, the "First 30 Minutes" runbook (Section 4) supersedes business-as-usual.

> **Never send a CRITICAL template without legal counsel review.** Speed matters; unreviewed legal exposure matters more.

---

## 1. Severity Tiers

| Tier | Scope | PII / financial | Regulatory | Approval | Post-mortem |
|---|---|---|---|---|---|
| **MINOR** | < 100 users affected | No PII exposed, no money lost or at risk | None | CS lead | Internal Slack note only |
| **MAJOR** | 100 â€“ 10,000 users affected | Possible PII exposure (not confirmed) OR possible money implication | Possible (consult counsel) | Founder | Internal post-mortem within 5 business days |
| **CRITICAL** | > 10,000 users affected | Confirmed PII breach OR confirmed financial loss | Required (FTC, GDPR 72h, state AG) | Founder + Legal counsel | Public post-mortem within 14 days |

**Severity escalation rules:**
- Any media inquiry escalates to MAJOR minimum.
- Any social post crossing 10k impressions escalates to MAJOR minimum.
- Any confirmed PII exposure regardless of count escalates to CRITICAL.
- Any GDPR Article 33 notification trigger escalates to CRITICAL.
- Any insurance carrier notification trigger escalates to CRITICAL.

---

## 2. Template anatomy

Every template in Section 3 has the following structure:

```
TEMPLATE ID:         scenario_severity (e.g., breach_critical)
SUBJECT:             [email/in-app subject line]
CHANNEL:             email | in-app | status page | social | SMS | phone | press release
RECIPIENT LIST:      who receives it
SENDER PERSONA:      CS rep | founder | legal | no-reply | system
REGULATORY TRIGGER:  FTC | GDPR 72h | state AG | none â€” and the action required
APPROVAL:            CS lead | founder | legal counsel
POST-MORTEM:         required? format?
FOLLOW-UP CADENCE:   when to send the next update
BODY:                draft language
```

Body language uses placeholders: `{user_first_name}`, `{incident_date}`, `{affected_count}`, `{remediation_steps}`, `{support_email}`, `{founder_name}`, `{incident_summary_url}`.

---

## 3. Templates â€” 10 scenarios Ã— 3 severities = 30 templates

---

### 3.1 AI-generated content compliance issue
*(False claim, prohibited claim, hallucinated stat in generated funnel/ad copy)*

---

#### TEMPLATE: ai_content_minor

- **Subject:** A quick note about content generated on your funnel
- **Channel:** in-app banner + email
- **Recipient list:** affected users only (< 100)
- **Sender persona:** CS rep
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal Slack note in #incidents
- **Follow-up cadence:** Single touch; mark resolved when user confirms edit

**Body:**
> Hi {user_first_name},
>
> Our compliance check flagged a line in the funnel content we generated for you. The phrase "{flagged_phrase}" could be read as a guarantee or unverified claim, which violates ad-platform policy for {platform}.
>
> We've drafted three compliant rewrites for you â€” pick one from your dashboard: {edit_link}
>
> No action is required if your funnel isn't running paid ads, but we recommend the swap regardless.
>
> â€” {cs_rep}, FunelAI

---

#### TEMPLATE: ai_content_major

- **Subject:** Action required: compliance review of your FunelAI content
- **Channel:** email + in-app full-screen modal
- **Recipient list:** affected users (100 â€“ 10,000)
- **Sender persona:** founder
- **Regulatory trigger:** Possible â€” flag to legal counsel for FTC endorsement-guide review
- **Approval:** founder
- **Post-mortem:** Internal post-mortem within 5 business days; root-cause classification of the prompt or model regression
- **Follow-up cadence:** Day 0 notification, Day 3 status update, Day 7 closure

**Body:**
> Hi {user_first_name},
>
> {founder_name} here, founder of FunelAI.
>
> Between {incident_start} and {incident_end}, the AI that drafts your funnel and ad copy generated content that may include claims we cannot substantiate. We identified the issue on {detection_date} and have already updated the underlying model to prevent it from recurring.
>
> Your account is on the affected list. Specifically: {specific_issue_for_this_user}.
>
> What we've done:
> 1. Auto-paused affected ads on {pause_date}. You'll see them in the "paused â€” needs review" tab.
> 2. Generated three replacement variants compliant with {platform} policy.
> 3. Refunded the ad spend that ran with the affected copy: ${refund_amount}.
>
> What we need from you:
> - Review and publish a replacement variant within 7 days: {dashboard_link}
> - If you have any saved screenshots or printouts of the original content, please replace them.
>
> If a customer of yours has already seen this content and is asking questions, here's a one-paragraph statement you're welcome to use: {customer_facing_statement_link}
>
> Reply directly to this email and you'll reach me.
>
> â€” {founder_name}, Founder, FunelAI

---

#### TEMPLATE: ai_content_critical

- **Subject:** Important notice from FunelAI about content generated on your account
- **Channel:** email + in-app + status page + press release (if media has picked it up)
- **Recipient list:** all affected users (> 10,000), plus regulators per legal advice
- **Sender persona:** founder, legal sign-off required
- **Regulatory trigger:** FTC notification likely required (false-advertising risk); coordinate with FTC liaison counsel; state AG notification if state-level consumer protection statute triggered
- **Approval:** founder + legal counsel
- **Post-mortem:** Public post-mortem within 14 days at funelai.com/incidents/{id}
- **Follow-up cadence:** Day 0 full notice, Day 1 status page update, Day 3 progress update, Day 7 remediation status, Day 14 public post-mortem, Day 30 closing summary

**Body:**
> {user_first_name},
>
> I'm writing to you directly about a serious issue affecting content generated by FunelAI.
>
> **What happened:** Between {incident_start} and {incident_end}, a regression in our content-generation model produced statistical and outcome claims that we cannot substantiate. {affected_count} customer accounts received content that included these claims. We identified the issue on {detection_date} after {detection_source}. We immediately rolled the model back to the prior stable version.
>
> **Why this matters for you:** If you ran ads or published funnels using this content, you may have made claims to your prospects that aren't backed by evidence. This creates legal exposure for you (and us) under FTC endorsement and substantiation rules. We are taking responsibility.
>
> **What we're doing:**
> 1. Auto-pausing all ads using affected content. Done as of {pause_complete_date}.
> 2. Refunding ad spend tied to affected content: estimated ${total_refund} across affected accounts. Yours: ${user_refund}, processed by {refund_date}.
> 3. Providing a remediation kit: compliant rewrites for every funnel touched, a customer-facing statement template, and a one-on-one call with a compliance specialist (free, 30 minutes): {kit_link}
> 4. Notifying the FTC and applicable state regulators about the model regression and remediation, per counsel.
> 5. Publishing a full public post-mortem at funelai.com/incidents/{id} within 14 days.
>
> **What you need to do:**
> 1. Review your affected funnels and replace the flagged content within 14 days: {dashboard_link}
> 2. If any of your customers may have relied on the unsubstantiated claims, contact them with the statement template.
> 3. If you receive a complaint, escalation, or regulator contact, forward it to legal@funelai.com immediately â€” we will respond on your behalf at no cost, per our customer-protection commitment.
>
> **Who to contact:**
> - Compliance specialist (your assigned line): {compliance_phone}
> - Legal escalation: legal@funelai.com
> - I personally read every reply to this email.
>
> This shouldn't have happened. I'm sorry it did. We're going to make it right.
>
> â€” {founder_name}, Founder & CEO, FunelAI
>
> ---
>
> *This notice is being sent to all affected customers in compliance with our Terms of Service and applicable consumer protection regulations. A public statement is posted at funelai.com/incidents/{id}.*

---

### 3.2 Data breach / unauthorized access

---

#### TEMPLATE: breach_minor

- **Subject:** Notice: limited access anomaly affecting your account
- **Channel:** email
- **Recipient list:** affected users (< 100), no PII confirmed exposed
- **Sender persona:** CS rep
- **Regulatory trigger:** None (no PII confirmed). Document decision in incident log.
- **Approval:** CS lead + Security lead
- **Post-mortem:** Internal note + access-log audit
- **Follow-up cadence:** Single touch, with offer to chat if questions

**Body:**
> Hi {user_first_name},
>
> Our security monitoring detected an unusual access pattern affecting your FunelAI account on {incident_date}. After investigation, we confirmed that no personal information, payment data, or lead data was viewed or exported.
>
> Out of caution, we've already:
> - Invalidated all active sessions on your account (you'll need to log in again)
> - Reset your API keys (regenerate them in Settings â†’ API)
>
> We recommend enabling two-factor authentication if you haven't yet: {2fa_link}
>
> Reply to this email if you have any questions.
>
> â€” {cs_rep}, FunelAI

---

#### TEMPLATE: breach_major

- **Subject:** Important security notice about your FunelAI account
- **Channel:** email + in-app banner
- **Recipient list:** affected users (100 â€“ 10,000), possible PII exposure not confirmed
- **Sender persona:** founder + Security lead (joint signature)
- **Regulatory trigger:** Possible â€” GDPR Article 33 clock starts at confirmation of breach; consult counsel within 24h to determine if "personal data breach" definition is met. State breach-notification statutes vary; counsel determines per-state.
- **Approval:** founder + legal counsel
- **Post-mortem:** Internal post-mortem within 5 business days; affected-customer summary within 10 days
- **Follow-up cadence:** Day 0 notice, Day 3 investigation update, Day 7 root cause, Day 14 final disposition

**Body:**
> {user_first_name},
>
> On {detection_date}, our security team detected unauthorized access to a limited portion of FunelAI infrastructure. We are notifying you now because your account is in the potentially affected set.
>
> **What we know:**
> - The unauthorized access occurred between {incident_start} and {incident_end}.
> - The affected systems contained {data_categories} â€” for example, email addresses and account metadata.
> - We have not confirmed exfiltration of personal information at this time, but we cannot rule it out, which is why we are notifying you now.
> - Payment card data is NOT stored on FunelAI systems and was NOT in the affected scope.
>
> **What we've done:**
> - Closed the access vector ({remediation_summary})
> - Rotated all credentials, tokens, and API keys for affected accounts
> - Forced password reset on next login
> - Engaged external forensics ({forensics_firm}) to investigate scope
> - Notified law enforcement
> - Begun the regulatory notification process per counsel
>
> **What you should do:**
> 1. Reset your password on next login (forced)
> 2. Enable two-factor authentication: {2fa_link}
> 3. Review your account audit log for unfamiliar activity: {audit_log_link}
> 4. If you reused this password elsewhere, change it there too
>
> We will send a follow-up by {next_update_date} with the results of the forensic review.
>
> Reply to this email or call {security_hotline} with questions. Our security team is staffing it round-the-clock for the next 14 days.
>
> â€” {founder_name}, Founder, and {security_lead_name}, Head of Security

---

#### TEMPLATE: breach_critical

- **Subject:** Notice of data security incident affecting your FunelAI account
- **Channel:** email + in-app + status page + press release + direct mail (for affected users in jurisdictions requiring written notice)
- **Recipient list:** all affected users (> 10,000), regulators (FTC, EU DPAs, state AGs per applicability), credit bureaus if SSN/financial data involved
- **Sender persona:** founder, with legal-counsel review and statement
- **Regulatory trigger:** **GDPR Article 33** â€” 72-hour clock from awareness. **State AG notification** â€” varies by state, some require notice without unreasonable delay. **FTC** â€” if practices may be deceptive or unfair. **HHS / sector regulators** â€” if any health-adjacent data involved. **Insurance carrier** â€” notify cyber carrier same day. Counsel coordinates all.
- **Approval:** founder + legal counsel + cyber insurance carrier acknowledged
- **Post-mortem:** Public post-mortem within 30 days at funelai.com/incidents/{id}. Board notification same day. Insurance claim opened same day.
- **Follow-up cadence:** Day 0 notice + status page, Day 1 update, Day 3 update, Day 7 forensic status, Day 14 remediation status, Day 30 public post-mortem, Day 60 closure summary, Day 90 anniversary check-in

**Body:**
> {user_first_name},
>
> I'm writing to inform you of a data security incident that affects your FunelAI account. I'm sorry to be writing this. Below is everything we know, what we're doing, and what we're asking you to do.
>
> **What happened:**
> On {detection_date} at approximately {detection_time}, our security team detected unauthorized access to a FunelAI database that included {data_categories} for approximately {affected_count} customer accounts. The unauthorized access occurred between {incident_start} and {incident_end}. We have confirmed that data was exfiltrated.
>
> **Information involved:**
> - Name and email address: yes
> - Hashed password: yes (cryptographically protected; should be rotated)
> - Business information you provided (industry, company name, phone): yes
> - Lead data (your leads' names, emails, phones): {yes_no}
> - Funnel content: {yes_no}
> - Payment card data: NO â€” payment data is stored only with our PCI-compliant processor and was not in scope
> - Government-issued IDs: NO
> - Social Security numbers: NO
>
> **What we've done:**
> 1. Contained the incident within {containment_time} of detection.
> 2. Engaged {forensics_firm} for independent forensic investigation.
> 3. Notified law enforcement and are cooperating fully.
> 4. Notified regulators in applicable jurisdictions, including {regulator_list}.
> 5. Notified our cyber-insurance carrier and opened a claim.
> 6. Rotated all credentials, API keys, OAuth tokens for affected accounts.
> 7. Forced a password reset for every affected user.
> 8. Engaged {identity_protection_provider} to offer {months}-month identity-monitoring service at no cost to you (enrollment link below).
>
> **What you should do, in order:**
> 1. **Log in to FunelAI and reset your password.** If you reused this password anywhere else, change it there too: {password_reset_link}
> 2. **Enable two-factor authentication:** {2fa_link}
> 3. **Enroll in free identity monitoring** with code {enrollment_code} at {monitoring_link}. Available for {duration}.
> 4. **Watch for phishing.** Attackers may use the information to impersonate FunelAI. We will never ask for your password by email. If in doubt, forward suspicious emails to phishing@funelai.com.
> 5. **Review your audit log.** {audit_log_link}
>
> **For your customers and leads:**
> If lead data captured through your FunelAI funnels was involved, you may have your own notification obligations to those individuals under applicable law. We have prepared a notification template and FAQ you can adapt: {leads_kit_link}. Our legal team is available to help â€” email legal@funelai.com.
>
> **Ongoing communication:**
> - Live status page: status.funelai.com/incidents/{id}
> - Dedicated incident hotline: {incident_hotline} (24/7 for the next 30 days)
> - Email: incident-{id}@funelai.com
> - Public post-mortem: funelai.com/incidents/{id} within 30 days
>
> I'll send personal follow-ups at Day 7, Day 30, and Day 60. The buck stops with me on this. We will tell you everything we learn as soon as we can confirm it.
>
> â€” {founder_name}, Founder & CEO, FunelAI
>
> ---
>
> *Legal: This notice is being provided pursuant to applicable data breach notification laws. For residents of the EU/EEA, the supervisory authority that received our Article 33 notification is {DPA_name}. For residents of California, your CCPA/CPRA rights and contact information for the California Privacy Protection Agency are available at {CCPA_link}. {Other_state_specific_disclosures}.*

---

### 3.3 Payment processor outage (PayPal or Stripe)

---

#### TEMPLATE: payment_minor

- **Subject:** Brief payment processing delay
- **Channel:** in-app banner
- **Recipient list:** users who hit a failed checkout during the window (< 100)
- **Sender persona:** system (no-reply)
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal ticket only
- **Follow-up cadence:** Single banner, auto-clears when processor recovers

**Body (banner):**
> Card payments are experiencing brief delays due to a {processor_name} outage. Your subscription is unaffected â€” retry checkout in 10 minutes or pick a different payment method.

---

#### TEMPLATE: payment_major

- **Subject:** Payment processing issue â€” your account is safe
- **Channel:** email + in-app banner + status page
- **Recipient list:** affected users (100 â€“ 10,000), including those whose recurring charges failed
- **Sender persona:** CS rep
- **Regulatory trigger:** None (failed charge is not a breach), but document any failed-charge auto-downgrade decisions for fairness review
- **Approval:** founder
- **Post-mortem:** Internal post-mortem; review auto-downgrade behavior
- **Follow-up cadence:** Day 0 notice, Day 1 resolution update, Day 7 closure for any users with stuck access

**Body:**
> Hi {user_first_name},
>
> Earlier today between {incident_start} and {incident_end}, our payment processor {processor_name} had an outage that prevented some recurring charges from going through, including yours. This was on their end, not yours.
>
> What we've done:
> - Suspended all auto-downgrades from failed-payment for the next 72 hours
> - Will retry your charge automatically once {processor_name} confirms recovery
> - Your account remains on its current plan with no interruption
>
> What you should do:
> - Nothing right now. If we still can't process by {retry_deadline}, we'll reach out individually.
> - If you'd prefer to update or switch your payment method now: {billing_link}
>
> Status page: status.funelai.com
>
> â€” {cs_rep}, FunelAI

---

#### TEMPLATE: payment_critical

- **Subject:** Important notice about payments on FunelAI
- **Channel:** email + in-app + status page + social
- **Recipient list:** all paid customers (> 10,000), regardless of whether their specific charge was attempted
- **Sender persona:** founder
- **Regulatory trigger:** Possible state consumer-protection notification if duplicate charges or unauthorized debits occurred. Coordinate with counsel and processor. Insurance carrier notification if losses material.
- **Approval:** founder + legal counsel
- **Post-mortem:** Public post-mortem within 14 days; reconciliation report shared with customers within 30 days
- **Follow-up cadence:** Day 0 notice, hourly status page during incident, Day 1 reconciliation, Day 7 individual confirmation, Day 14 post-mortem

**Body:**
> {user_first_name},
>
> Between {incident_start} and {incident_end}, our payment processor {processor_name} experienced a major outage that affected billing across FunelAI. I want to be transparent about what happened and what we're doing.
>
> **What happened:**
> {processor_name} had a {outage_description}. During the window, some charges did not process, some processed twice, and some processed but the confirmation did not reach FunelAI. {processor_name}'s incident report: {processor_link}.
>
> **How this might affect you:**
> - **Missed charge:** No action needed â€” we will retry once processor recovery is confirmed and {processor_name} verifies the original attempt was not silently completed. We will never double-bill you because of this incident.
> - **Duplicate charge:** We are actively reconciling. If a duplicate is identified on your account, we will refund automatically and email confirmation within 7 days.
> - **Service interruption:** None. We've suspended all auto-downgrades for the next 14 days.
> - **Confused billing display:** Your dashboard may show an inaccurate next-charge date until the reconciliation completes by {reconciliation_date}.
>
> **What we're doing:**
> 1. Working directly with {processor_name} engineering for hour-by-hour reconciliation.
> 2. Posting hourly updates to status.funelai.com/incidents/{id}.
> 3. Refunding any duplicate or unauthorized charge automatically â€” no support ticket required.
> 4. Adding a fallback payment processor to our roadmap (target {fallback_date}) so this single point of failure is removed.
>
> **What you can do:**
> 1. Check {billing_link} on or after {reconciliation_date} to confirm your billing state.
> 2. If you see a charge you can't account for, reply to this email and we'll resolve it within 24 hours.
> 3. If your bank notified you of a declined charge, ignore it for now â€” our retries are coordinated and you don't need to update anything.
>
> I'll send a follow-up the day reconciliation is complete.
>
> â€” {founder_name}, Founder, FunelAI

---

### 3.4 Ad platform mass-ban of customer accounts

---

#### TEMPLATE: adban_minor

- **Subject:** Heads up: {ad_platform} flagged your ad account
- **Channel:** in-app + email
- **Recipient list:** affected users (< 100)
- **Sender persona:** CS rep
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note; pattern-check whether shared template caused it
- **Follow-up cadence:** Single notice + appeal-resource link

**Body:**
> Hi {user_first_name},
>
> {ad_platform} flagged your ad account today. This often happens automatically and is reversible.
>
> Most likely cause based on what we see: {likely_cause}.
>
> We've prepared a one-page appeal kit for {ad_platform} situations: {kit_link}. Most users get their account back within 3-5 business days using it.
>
> Reply if you'd like our team to draft the appeal for you.
>
> â€” {cs_rep}

---

#### TEMPLATE: adban_major

- **Subject:** {ad_platform} mass-ban affecting FunelAI users â€” we're on it
- **Channel:** email + in-app + community post
- **Recipient list:** affected users (100 â€“ 10,000)
- **Sender persona:** founder
- **Regulatory trigger:** None against us, but if we believe {ad_platform} is misapplying policy at scale, coordinate with counsel on possible {ad_platform} partnership escalation and external advocacy
- **Approval:** founder
- **Post-mortem:** Internal post-mortem; if our content patterns contributed, model adjustment within 14 days
- **Follow-up cadence:** Day 0 notice, Day 2 escalation status with {ad_platform}, Day 7 appeal outcomes

**Body:**
> Hi {user_first_name},
>
> In the last {hours} hours, {ad_platform} banned a meaningful number of customer ad accounts running FunelAI-generated campaigns, including yours. We're calling this out openly because (a) you deserve to know we see it and (b) we're already escalating.
>
> **What we've confirmed:**
> - {affected_count} accounts have been affected.
> - {pattern_finding} appears to be the trigger {ad_platform}'s automated systems flagged.
> - This is not a FunelAI compliance violation â€” but {ad_platform}'s automation appears to be over-broad.
>
> **What we're doing:**
> 1. Engaging our {ad_platform} partner manager directly. Escalation ticket {ticket_id}.
> 2. Drafting appeal letters customized to each affected account. Yours: {your_appeal_link}.
> 3. Updating our content generator to avoid the pattern going forward.
> 4. If you want to switch traffic to a different channel (e.g., TikTok, Google) while this is resolved, we have a 1-click migration guide: {migration_link}.
>
> **What you should do:**
> 1. Submit the prepared appeal via {ad_platform}'s system: {your_appeal_link}
> 2. Pause any new ad creation on {ad_platform} until reinstatement
> 3. Consider migrating to a fallback channel â€” we'll help
>
> I'll update you again within 48 hours.
>
> â€” {founder_name}, FunelAI

---

#### TEMPLATE: adban_critical

- **Subject:** Coordinated action with {ad_platform} â€” large-scale ad account ban affecting FunelAI customers
- **Channel:** email + in-app + status page + press release + community + founder public post
- **Recipient list:** all affected users (> 10,000), {ad_platform} partner team, press if necessary
- **Sender persona:** founder
- **Regulatory trigger:** None directly, but engage counsel on (a) FTC notice if {ad_platform} action prevents fulfillment of paid services, (b) class-action exposure mitigation, (c) press strategy
- **Approval:** founder + legal counsel + PR counsel
- **Post-mortem:** Public post-mortem within 14 days; commitment to platform-diversification roadmap
- **Follow-up cadence:** Day 0 full notice, daily updates until resolved, Day 14 post-mortem

**Body:**
> {user_first_name},
>
> Yesterday, {ad_platform} banned more than {affected_count} ad accounts running FunelAI-generated campaigns within a {hours}-hour window. This affects the majority of our customers running paid traffic on {ad_platform}. I'm writing to tell you exactly what's happening, what we're doing, and what your options are.
>
> **What we know:**
> - {ad_platform} has confirmed the bans were triggered by their {system_name} flagging a pattern across multiple advertisers.
> - The pattern, as best we can tell, is {pattern}. This was not a violation of {ad_platform}'s written policy; it was over-aggressive automated enforcement.
> - We have escalated to {ad_platform}'s policy team and partner team. We have a meeting scheduled for {meeting_date}.
>
> **What we're committing to:**
> 1. **Bridge credit:** Every affected customer gets a {bridge_credit} credit on their FunelAI subscription, applied automatically by {credit_date}. No action needed.
> 2. **Free migration to alternative ad channels:** Our team will set up your campaigns on Google, TikTok, or YouTube within {migration_sla} of your request. Free, no upsell.
> 3. **Pre-drafted appeal kit:** Sent separately within the next hour. Custom to your account.
> 4. **Status page and daily updates** at status.funelai.com/incidents/{id} until every affected account is either reinstated or migrated.
> 5. **Platform diversification roadmap:** We're accelerating our commitment that no customer will be more than 7 days from a working alternative channel. Public roadmap by {roadmap_date}.
>
> **What you should do now:**
> 1. Submit the appeal kit (link below).
> 2. Reply to this email or message us in-app to request migration.
> 3. Do not create new {ad_platform} accounts during the freeze â€” that can compound the ban.
>
> **Your appeal kit:** {appeal_kit_link}
> **Request migration:** {migration_request_link}
> **Status page:** status.funelai.com/incidents/{id}
> **Direct line during this incident:** {incident_phone}
>
> I'll publish a recorded video update every 24 hours at {video_url} until this is fully resolved. We will not stop until every customer is either reinstated or running profitably somewhere else.
>
> â€” {founder_name}, Founder & CEO

---

### 3.5 RevTry voice outage / wrong-number-dialed incidents

---

#### TEMPLATE: revtry_minor

- **Subject:** RevTry brief outage notice
- **Channel:** in-app banner
- **Recipient list:** affected users (< 100, e.g., short regional voice-provider outage)
- **Sender persona:** system
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note
- **Follow-up cadence:** Banner clears on resolution

**Body (banner):**
> RevTry voice service had a {duration} outage between {start} and {end}. {n_calls} of your calls were queued and have now been completed. No action needed.

---

#### TEMPLATE: revtry_major

- **Subject:** RevTry call outage â€” what we did with your queued calls
- **Channel:** email + in-app
- **Recipient list:** affected users (100 â€“ 10,000)
- **Sender persona:** CS rep
- **Regulatory trigger:** **TCPA risk if wrong numbers were dialed** â€” engage counsel within 4h to determine notification needs. Document call logs.
- **Approval:** founder
- **Post-mortem:** Internal post-mortem with telephony provider; review call-log audit
- **Follow-up cadence:** Day 0 notice, Day 2 with reconciliation summary

**Body:**
> Hi {user_first_name},
>
> Between {incident_start} and {incident_end}, RevTry experienced a voice outage that affected {your_n_calls} of your follow-up calls.
>
> **What happened with your calls:**
> - {n_completed_late} were completed after recovery, on a 4-hour delay.
> - {n_voicemail} went to voicemail and were left a standard message.
> - {n_missed} could not be retried and have been flagged in your dashboard for manual follow-up.
> - {n_misdialed} â€” if any â€” are detailed below and were corrected with a follow-up call/message to the correct lead.
>
> If a call reached an unintended recipient, we sent an apology and stop-call confirmation, and we logged the event for our records. If you receive any complaint related to these calls, forward it to legal@funelai.com and we will respond on your behalf at no cost.
>
> Your dashboard now shows a "needs attention" filter for the affected calls: {dashboard_link}
>
> â€” {cs_rep}

---

#### TEMPLATE: revtry_critical

- **Subject:** Important: RevTry voice incident â€” what happened and what we're doing
- **Channel:** email + in-app + status page + counsel-coordinated regulator notice
- **Recipient list:** all affected users (> 10,000) + regulators
- **Sender persona:** founder + Head of RevTry (joint)
- **Regulatory trigger:** **TCPA** â€” if wrong numbers, do-not-call list violations, or after-hours calls occurred, counsel-coordinated outreach to affected non-customers. **FCC** â€” possible, depending on scale. **State PUC** â€” varies. Engage counsel within 1 hour. Notify cyber/E&O insurance carrier same day.
- **Approval:** founder + legal counsel + insurance carrier acknowledgment
- **Post-mortem:** Public post-mortem within 14 days; offer customers and any wrong-number recipients a clear remediation path
- **Follow-up cadence:** Day 0 notice, hourly status page, Day 1 outreach to wrong-number recipients, Day 7 reconciliation, Day 14 post-mortem

**Body:**
> {user_first_name},
>
> Between {incident_start} and {incident_end}, RevTry â€” our voice agent â€” experienced a serious incident. {n_misdialed_calls} calls were placed to phone numbers that did not belong to the intended lead. This happened because of {root_cause_summary}. We caught and stopped it on {detection_date}.
>
> **What this means:**
> - **For your leads:** their actual follow-up calls did not happen during the window. We've flagged each one in your dashboard for manual follow-up or rescheduled RevTry call. You decide.
> - **For unintended recipients:** these are people who received an unexpected call from your business name. We have already, with your permission baked into our Master Services Agreement, sent each unintended recipient an apology, recorded their number on our internal do-not-call list, and offered a contact channel for any concern.
> - **For you:** if any unintended recipient files a complaint, regulator inquiry, or lawsuit, we cover the cost of response under our Customer Protection Commitment. Forward everything to legal@funelai.com.
>
> **What we did:**
> 1. Stopped all RevTry outbound calls within {containment_time} of detection.
> 2. Resumed only after the root cause was fixed and a triple-validation step was added before any number is dialed.
> 3. Notified the FCC and applicable state regulators per counsel.
> 4. Notified our E&O insurance carrier and opened a claim covering customer remediation costs.
> 5. Audited every call placed during the window; flagged outcomes in your dashboard.
>
> **What you should do:**
> 1. Review your flagged calls: {dashboard_link}
> 2. If a complaint reaches you about a FunelAI-originated call, forward it to legal@funelai.com â€” do not respond on your own.
> 3. Consider the Customer-Lead-Confirmation feature now available (off by default), which requires double-confirmation before dialing: {feature_link}
>
> **What we're changing structurally:**
> - Triple validation of lead phone number before dial (already deployed)
> - Real-time misdial detection via audio classifier (target {date})
> - Quarterly third-party audit of RevTry's telephony path (first audit: {date})
>
> Direct line for this incident: {revtry_incident_line}
> Status page: status.funelai.com/incidents/{id}
> Public post-mortem: funelai.com/incidents/{id} within 14 days
>
> â€” {founder_name}, Founder, and {revtry_head_name}, Head of RevTry

---

### 3.6 Email/SMS deliverability incident

---

#### TEMPLATE: deliverability_minor

- **Subject:** Brief delivery delay on some emails/SMS
- **Channel:** in-app banner
- **Recipient list:** affected users (< 100)
- **Sender persona:** system
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note
- **Follow-up cadence:** Banner clears on resolution

**Body (banner):**
> Some of your outbound emails were delayed by {duration} due to a {provider} queue backup. Delivery is catching up â€” no resend needed.

---

#### TEMPLATE: deliverability_major

- **Subject:** Email/SMS delivery issue â€” here's what's happening
- **Channel:** email + in-app
- **Recipient list:** affected users (100 â€“ 10,000)
- **Sender persona:** CS rep
- **Regulatory trigger:** None directly; if a FunelAI domain was blacklisted on a shared IP, document remediation for accountability
- **Approval:** founder
- **Post-mortem:** Internal post-mortem with deliverability provider
- **Follow-up cadence:** Day 0 notice, Day 1 reconciliation status

**Body:**
> Hi {user_first_name},
>
> Our outbound email/SMS provider {provider} experienced a {issue_summary} that affected {n_messages} of your messages between {incident_start} and {incident_end}.
>
> **What we did:**
> - Re-queued and resent all bounced messages where appropriate
> - Removed FunelAI sending domains from any blacklists triggered ({blacklist_status})
> - Switched affected sending pools to a backup IP range
>
> **What you should do:**
> - Review your campaign dashboard for any "resend" prompts: {dashboard_link}
> - Reply if you see a specific lead you expected to reach who didn't get the message
>
> â€” {cs_rep}

---

#### TEMPLATE: deliverability_critical

- **Subject:** Important update about email and SMS delivery from FunelAI
- **Channel:** email + in-app + status page + community
- **Recipient list:** all paid users (> 10,000), even unaffected, because reputation is shared
- **Sender persona:** founder
- **Regulatory trigger:** **CAN-SPAM / GDPR / CASL** â€” engage counsel on whether any retried sends could be interpreted as unauthorized resends. **State UTRAS / TCPA for SMS** â€” engage counsel on opt-in chain integrity.
- **Approval:** founder + legal counsel
- **Post-mortem:** Public post-mortem within 14 days
- **Follow-up cadence:** Day 0 notice, hourly status updates, Day 7 reconciliation, Day 14 post-mortem

**Body:**
> {user_first_name},
>
> FunelAI's email and SMS sending infrastructure had a serious incident over the last {hours} hours. Here's exactly what happened and what we're doing.
>
> **What happened:**
> {provider} de-listed and then blacklisted a shared IP range we use after a flagged pattern from {root_cause_summary}. This caused {n_messages} messages across {affected_count} customer accounts to be deferred, bounced, or queued for unusually long delays.
>
> **The blast radius:**
> - {n_bounced} messages bounced. We will not auto-resend without your review, to preserve your opt-in integrity.
> - {n_delayed} messages were delivered late ({hours} late on average).
> - {n_lost} messages could not be recovered. These are listed in your dashboard with a one-click reschedule option.
>
> **What we've done:**
> 1. Migrated all sending to a clean dedicated IP pool by {migration_complete_time}.
> 2. Engaged {deliverability_consultant} to re-warm reputation and submit removal requests across all blocklists.
> 3. Engaged counsel to confirm our retry strategy doesn't violate opt-in laws (we are not auto-resending where consent could be in question).
> 4. Paused all marketing-class outbound sends platform-wide for {hours} hours to protect every customer's deliverability.
> 5. Audited and confirmed that no customer's opt-out preferences were dropped.
>
> **What we're committing to:**
> 1. Bridge credit of {credit_amount} on every affected paid account.
> 2. New deliverability dashboard ({date}) showing your reputation in real time.
> 3. Option for any customer above {tier} to use a dedicated IP at no extra cost ({date}).
> 4. Public post-mortem at funelai.com/incidents/{id} within 14 days.
>
> **What you should do:**
> 1. Review the "needs reschedule" tab in your dashboard: {dashboard_link}
> 2. Don't manually resend everything â€” let our auto-throttling protect your reputation as we re-warm
> 3. If a specific customer didn't get a critical message, contact them through another channel
>
> â€” {founder_name}

---

### 3.7 Model regression (quality drop affecting many funnels)

---

#### TEMPLATE: regression_minor

- **Subject:** Quick model update â€” re-generate if you want
- **Channel:** in-app
- **Recipient list:** affected users (< 100)
- **Sender persona:** system
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note in model-quality channel
- **Follow-up cadence:** Single banner

**Body:**
> We pushed a model update that caused some recently-generated funnels to come out lower-quality than usual. We've rolled it back. If your funnel was generated between {start} and {end}, we recommend re-generating with the same prompt. One-click: {regen_link}

---

#### TEMPLATE: regression_major

- **Subject:** Funnel regeneration recommended for funnels created this week
- **Channel:** email + in-app
- **Recipient list:** affected users (100 â€“ 10,000)
- **Sender persona:** Head of AI / CS rep
- **Regulatory trigger:** None unless quality drop produced compliance issues (then escalate to ai_content scenario)
- **Approval:** founder
- **Post-mortem:** Internal post-mortem; model eval gating review
- **Follow-up cadence:** Day 0 notice, Day 3 reminder for non-regenerated funnels

**Body:**
> Hi {user_first_name},
>
> Between {incident_start} and {incident_end}, a regression in our content model caused funnels generated during that window to come out below our quality bar. We've rolled the model back and re-tested.
>
> Your account had {n_funnels} funnel(s) generated during the window: {affected_funnel_list}.
>
> What we recommend:
> 1. Re-generate the affected funnels (one click, copy preserved if you've edited it): {regen_link}
> 2. If you've already published, the live version isn't broken â€” but a regenerated version will likely outperform it.
>
> What we did:
> - Rolled back the model on {rollback_date}
> - Added a regression test that would have caught this; we'll be transparent in our public release notes
> - Crediting any ad spend that ran with materially-underperforming generated copy (Scale and Agency tiers, automatic): {credit_terms}
>
> â€” {cs_rep}, FunelAI

---

#### TEMPLATE: regression_critical

- **Subject:** FunelAI model regression â€” what happened, what to do
- **Channel:** email + in-app + status page + community + founder public post
- **Recipient list:** all affected users (> 10,000)
- **Sender persona:** founder + Head of AI
- **Regulatory trigger:** If regression produced any false claims, ESCALATE to ai_content_critical concurrently and follow FTC pathway
- **Approval:** founder + Head of AI + legal counsel
- **Post-mortem:** Public post-mortem within 14 days; model release-gating SOP updated within 30 days
- **Follow-up cadence:** Day 0 notice, Day 1 status, Day 7 regeneration completion stats, Day 14 post-mortem

**Body:**
> {user_first_name},
>
> Between {incident_start} and {incident_end}, we shipped a model update that caused a significant quality regression in funnels and ad copy generated on FunelAI. {affected_count} customer accounts are affected, including yours.
>
> **What we mean by "regression":**
> The new model produced content that was {regression_description}. Some of you may have noticed lower conversion or more rejected ads in the last {days} days. We did not catch it before release because our eval coverage missed {coverage_gap}.
>
> **Important:** We are auditing every piece of generated content from the window for compliance issues. If your content also crosses into a compliance issue, you will receive a separate notice with refunds and remediation per our AI content protocol. That review completes by {audit_complete_date}.
>
> **What we're doing for you:**
> 1. **Free regeneration** of every funnel and ad created in the window. One-click in the affected-funnel tab: {regen_link}
> 2. **Ad spend credit** equal to the difference between the regression-window benchmark CTR and historical baseline, capped at {cap} per account. Automatic.
> 3. **Subscription credit** of {sub_credit} on your next renewal.
> 4. **Public post-mortem** within 14 days describing the eval gap and the new gating SOP.
> 5. **Independent model audit** by {audit_firm} of the model train and eval pipeline, public summary by {audit_date}.
>
> **What you should do:**
> 1. Open the "affected funnels" filter in your dashboard
> 2. Regenerate; review; republish if happy
> 3. If you'd like a CS rep to do the regen with you live, book here: {calendly_link}
>
> Direct line: {incident_line}
> Status page: status.funelai.com/incidents/{id}
>
> â€” {founder_name}, Founder, and {head_of_ai_name}, Head of AI

---

### 3.8 Webhook delivery storm (failed/duplicated events)

---

#### TEMPLATE: webhook_minor

- **Subject:** Brief webhook delay
- **Channel:** in-app + status page
- **Recipient list:** affected users (< 100, typically API/integration users)
- **Sender persona:** system
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note
- **Follow-up cadence:** Banner clears on resolution

**Body (banner):**
> Webhook deliveries are catching up after a brief queue backlog. Expect normal delivery within {duration}. No duplicates expected.

---

#### TEMPLATE: webhook_major

- **Subject:** Webhook delivery issue â€” review your integrations
- **Channel:** email + in-app
- **Recipient list:** affected API/webhook customers (100 â€“ 10,000)
- **Sender persona:** CS rep + Eng on-call
- **Regulatory trigger:** None unless event duplication caused unauthorized financial actions (then escalate)
- **Approval:** founder
- **Post-mortem:** Internal post-mortem; idempotency-key audit
- **Follow-up cadence:** Day 0 notice, Day 1 reconciliation, Day 3 closure

**Body:**
> Hi {user_first_name},
>
> Between {incident_start} and {incident_end}, our webhook delivery system either retried or failed-and-dropped events for your account. Specifically:
>
> - {n_duplicated} events were delivered more than once (idempotency-key was set, so well-behaved consumers will have dedupedthem)
> - {n_failed} events failed permanently and are listed in your dashboard for manual retry
>
> What you should do:
> 1. Confirm your webhook consumer is using the `Idempotency-Key` header (it should be â€” but please verify): {docs_link}
> 2. Review the manual-retry list: {dashboard_link}
> 3. If you saw any double-actions in your downstream system (duplicate emails, duplicate CRM records), contact us and we'll help reconcile
>
> â€” {cs_rep}

---

#### TEMPLATE: webhook_critical

- **Subject:** Webhook delivery incident â€” action required for your integrations
- **Channel:** email + in-app + status page + dev mailing list
- **Recipient list:** all integration customers (> 10,000)
- **Sender persona:** founder + Head of Engineering
- **Regulatory trigger:** If event storm caused unauthorized financial actions in customer systems, ESCALATE per insurance carrier and counsel; possible regulatory implication depending on downstream systems
- **Approval:** founder + Head of Eng + legal counsel
- **Post-mortem:** Public post-mortem within 14 days; documented idempotency contract
- **Follow-up cadence:** Day 0 notice + status, hourly during, Day 7 reconciliation, Day 14 post-mortem

**Body:**
> {user_first_name},
>
> FunelAI's webhook delivery system experienced a serious incident over the last {hours} hours. {n_total_events} events were either duplicated, delivered out of order, or dropped. Your account is affected.
>
> **What happened:**
> {root_cause_summary}. The result was a backlog of {backlog_size} events that re-flushed when the system recovered, in some cases producing duplicates that should have been deduped but weren't because of {dedup_failure_summary}.
>
> **For your account, specifically:**
> - {n_duplicated_for_user} events flagged as duplicate (idempotency key matches an earlier event)
> - {n_dropped_for_user} events dropped without delivery â€” listed in your dashboard for manual replay
> - {n_out_of_order_for_user} events delivered out of order
>
> **What you should do urgently:**
> 1. **Audit your downstream system** for any unintended duplicate actions (extra emails to leads, extra CRM rows, double-paid affiliate payouts). We have an audit script that can help: {audit_script_link}
> 2. **If you find unintended financial or customer impact** in your system because of the duplicates, reply to this email â€” we will reimburse the cost of remediation under our Customer Protection Commitment.
> 3. **Verify your idempotency-key handling.** Our contract has always been: an Idempotency-Key header means you should dedupe. We failed to send it on {n_events} events because of the bug. Going forward, the header is guaranteed.
> 4. **Replay the dropped events** from your dashboard: {dashboard_link}. They're held for 30 days.
>
> **What we changed:**
> - Idempotency-key generation moved to the event-emit stage (was downstream)
> - Webhook delivery now uses strict ordering per `customer_id` with bounded queue
> - Hard cap on max retries per event, with explicit "dropped" status surfacing in the dashboard
> - Public webhook delivery SLO at status.funelai.com
>
> Public post-mortem within 14 days at funelai.com/incidents/{id}.
>
> â€” {founder_name} and {head_of_eng_name}

---

### 3.9 Integration provider revokes API access

---

#### TEMPLATE: integration_minor

- **Subject:** {provider} integration temporarily unavailable
- **Channel:** in-app
- **Recipient list:** users of that integration (< 100)
- **Sender persona:** system
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note
- **Follow-up cadence:** Banner clears on resolution

**Body (banner):**
> Our {provider} integration is temporarily paused while we resolve a token-refresh issue with {provider}. Existing data is safe. New syncs will resume within {duration}.

---

#### TEMPLATE: integration_major

- **Subject:** Update on the {provider} integration
- **Channel:** email + in-app
- **Recipient list:** affected users (100 â€“ 10,000)
- **Sender persona:** CS rep
- **Regulatory trigger:** None directly. If integration loss prevents you from delivering paid-for features, evaluate refund/credit obligations.
- **Approval:** founder
- **Post-mortem:** Internal post-mortem; partner-relations review
- **Follow-up cadence:** Day 0 notice, Day 3 negotiation status, Day 14 alternative integration if needed

**Body:**
> Hi {user_first_name},
>
> {provider} has revoked FunelAI's API access as of {revocation_date}, citing {stated_reason}. We disagree with this characterization and have escalated through {provider}'s partner team and policy team.
>
> **What this means for you:**
> - Existing data already in your FunelAI account is safe and unaffected.
> - New syncs from {provider} are paused.
> - Outbound automations that rely on {provider} are paused (you'll see them flagged in your dashboard).
>
> **What we're doing:**
> 1. Working directly with {provider} to restore access. Expected timeline: {timeline}.
> 2. Building a fallback integration with {alternative_provider} â€” beta available now to affected customers: {beta_link}
> 3. If we can't restore access by {deadline}, we will provide a prorated refund of any FunelAI feature tier that relied specifically on {provider}.
>
> **What you can do:**
> 1. Export any {provider}-sourced data from your FunelAI dashboard if you want a local copy: {export_link}
> 2. Try the {alternative_provider} beta
> 3. Watch for the next update by {next_update_date}
>
> â€” {cs_rep}

---

#### TEMPLATE: integration_critical

- **Subject:** {provider} access revoked â€” important update for FunelAI customers
- **Channel:** email + in-app + status page + community + press if {provider} is a major player
- **Recipient list:** all users (> 10,000 affected or > 10,000 paying customers regardless)
- **Sender persona:** founder
- **Regulatory trigger:** Antitrust/competition counsel engagement if {provider} action is anticompetitive. SEC/disclosure obligations if material to revenue. Counsel-coordinated.
- **Approval:** founder + legal counsel + (if material) board chair
- **Post-mortem:** Public post-mortem; commitment to integration redundancy
- **Follow-up cadence:** Day 0 full notice, daily for the first week, weekly until resolved

**Body:**
> {user_first_name},
>
> {provider}, one of our integration partners, has revoked FunelAI's API access. This affects more than {affected_count} customer accounts, including yours.
>
> **What happened:**
> On {revocation_date}, {provider} terminated our developer access without prior notice, citing {stated_reason}. We have asked for the specific evidence behind this characterization and have not received a substantive response.
>
> **What we're doing:**
> 1. **Legal escalation** through counsel â€” including possible antitrust complaint depending on what {provider} discloses about its decision criteria.
> 2. **Direct executive outreach** to {provider} leadership.
> 3. **Fallback integration sprint** â€” we are accelerating our {alternative_provider} integration into production within {sprint_days} days.
> 4. **Bridge credit** of {bridge_amount} on every affected paid account, applied automatically.
> 5. **Prorated refund** of any feature tier that materially depended on {provider}, if access isn't restored within {refund_deadline}.
> 6. **Full data export** of everything in your account, downloadable from your dashboard, no support ticket needed.
>
> **What you can do:**
> 1. Try the {alternative_provider} fallback (preview): {fallback_link}
> 2. Export your data: {export_link}
> 3. Tell us how this affects your business â€” reply to this email; I read every one
>
> **What we're committing to structurally:**
> - No single integration partner will represent more than {pct}% of customer dependencies going forward.
> - Public dependency map at funelai.com/dependencies starting {date}.
> - Pre-built fallback for every Tier 1 integration.
>
> Status page: status.funelai.com/incidents/{id}
> Direct line: {incident_line}
>
> â€” {founder_name}, Founder & CEO

---

### 3.10 Customer-side fraud (chargeback storm, affiliate fraud ring)

---

#### TEMPLATE: fraud_minor

- **Subject:** Notice: payment review on your account
- **Channel:** email
- **Recipient list:** affected users (< 100, e.g., isolated suspicious activity)
- **Sender persona:** CS rep
- **Regulatory trigger:** None
- **Approval:** CS lead
- **Post-mortem:** Internal note
- **Follow-up cadence:** Single notice; account-restoration confirmation

**Body:**
> Hi {user_first_name},
>
> Our payment review flagged some unusual activity on your FunelAI account today. As a precaution, we've temporarily paused {specific_action} while we review.
>
> If this was you, reply to this email and we'll restore access within 24 hours. If it wasn't, we've already secured your account and you don't need to do anything.
>
> â€” {cs_rep}

---

#### TEMPLATE: fraud_major

- **Subject:** Notice of a fraud-related review on your FunelAI account
- **Channel:** email + in-app
- **Recipient list:** affected users (100 â€“ 10,000, e.g., affiliate ring participants or chargeback wave participants)
- **Sender persona:** CS rep + Trust & Safety
- **Regulatory trigger:** None directly; document for AML/KYC posture; coordinate with payment processor on action
- **Approval:** founder
- **Post-mortem:** Internal post-mortem; affiliate program rule review; KYC tightening review
- **Follow-up cadence:** Day 0 notice, Day 7 disposition

**Body:**
> Hi {user_first_name},
>
> Our Trust & Safety team identified a pattern of activity associated with your account that matches behaviors we see in fraud rings. We are pausing payouts and account modifications for the next {hold_days} days while we review.
>
> **What this means:**
> - Your account access is preserved
> - Your existing funnels and leads continue to work
> - {specific_paused_actions} are temporarily paused
>
> **What you should do:**
> If you believe this is a mistake (it sometimes is, especially for legitimate high-volume affiliates), please reply with:
> 1. A short explanation of your traffic source and business model
> 2. The IDs of the transactions you'd like us to prioritize
>
> We aim to resolve each case within 5 business days.
>
> â€” {cs_rep}, Trust & Safety, FunelAI

---

#### TEMPLATE: fraud_critical

- **Subject:** Important update on FunelAI's affiliate / payment program
- **Channel:** email + in-app + community + status page
- **Recipient list:** all paid customers (> 10,000) â€” because fraud waves affect the whole community's processor reputation
- **Sender persona:** founder + Head of Trust & Safety
- **Regulatory trigger:** **FTC** â€” possible if affiliate program misrepresentation alleged. **State AG** â€” possible. **Payment network rules** (Visa/MC) â€” required notification if chargeback ratio breached thresholds. **AML/SAR filing** â€” if patterns meet financial-crime thresholds, FinCEN coordination. Counsel-coordinated.
- **Approval:** founder + legal counsel + Head of T&S + payment-processor liaison
- **Post-mortem:** Public summary at funelai.com/incidents/{id}; affiliate program SOP revisions
- **Follow-up cadence:** Day 0 notice, Day 1 program update, Day 7 changes, Day 14 reconciliation, Day 30 closure

**Body:**
> {user_first_name},
>
> Over the last {days} days, FunelAI detected and acted on a large coordinated fraud effort affecting our payment and affiliate systems. I want to be transparent about it because (a) it briefly affected our payment processor reputation and (b) we've made changes that will be visible to every customer.
>
> **What happened:**
> {fraud_description_summary} â€” for example, a coordinated set of accounts ran disputed transactions and abused our affiliate program. Affected: {affected_count} accounts on the fraud side, with downstream impact on the whole platform's processor reputation.
>
> **What we did:**
> 1. Closed and clawed back the implicated accounts and payouts (in coordination with our payment processor and counsel)
> 2. Notified payment network compliance per their rules
> 3. Notified law enforcement
> 4. Engaged a forensic accounting firm to scope financial impact
> 5. Suspended payouts platform-wide for {pause_hours} hours while we audited; payouts have since resumed for all confirmed-legitimate accounts
> 6. Tightened KYC for affiliates above {threshold}
>
> **What's changing for everyone:**
> - **Affiliate program:** new payout hold of {hold_days} days for new affiliates; existing affiliates above {tier} unaffected
> - **KYC:** light-touch identity verification for new payouts above {threshold} (under 2 minutes for a legitimate customer)
> - **Chargeback support:** new dispute toolkit in your dashboard, with templates and evidence packs
>
> **What you should do â€” for almost all of you, nothing.**
> If you're a legitimate affiliate and notice payout delay, look for a KYC prompt in your dashboard. Complete it once and you're back to normal.
> If you're a regular customer, you'll see no change other than (hopefully) less spam-y community behavior.
>
> If you were caught in the audit by mistake and your account is temporarily restricted, reply to this email and we will personally review within 1 business day.
>
> â€” {founder_name} and {head_of_ts_name}

---

## 4. First-30-Minutes Runbook â€” Any CRITICAL Incident

> **Use this when severity is or could be CRITICAL.** When in doubt, run it.

### Minute 0 â€” Detection

The on-call engineer or staff member who first identifies a CRITICAL-class signal does the following without waiting for approval:

1. Open an incident in PagerDuty / Linear with severity **SEV1** and label `critical-comms`.
2. Post in `#incidents` with one line: "Possible CRITICAL: [scenario]. IC needed."
3. Stop the bleeding if safe to do so â€” pause writes, disable the affected feature flag, revoke the leaked token. Do NOT delete logs. Do NOT alter affected data.

### Minute 0â€“5 â€” Incident Commander activated

The first on-call senior eng or T&S lead becomes the **Incident Commander (IC)** until relieved. The IC:

1. Confirms severity (MINOR / MAJOR / CRITICAL). Bias toward CRITICAL if any of: confirmed PII exposure, > 10k users impacted, regulatory clock running, media interest detected, payment loss confirmed.
2. Pages â€” by phone, not Slack â€” the following roles in this order:
   - **Founder/CEO** ({founder_name}, {founder_cell})
   - **Head of Engineering** ({head_eng_name}, {head_eng_cell})
   - **Head of Trust & Safety / Security** ({head_ts_name}, {head_ts_cell})
   - **Legal counsel** (firm: {legal_firm}, hotline: {legal_hotline})
   - **CS Lead** for customer-facing comms ({cs_lead_name}, {cs_lead_cell})
3. Opens the incident war room: Zoom bridge {war_room_url}.
4. Starts the **incident log** â€” every decision, time-stamped, in a single Google Doc at {incident_log_template}.

### Minute 5â€“15 â€” Containment + initial classification

The IC drives, in parallel:

1. **Containment** â€” Eng team verifies the bleed has stopped. If not, halt all writes to the affected system. Decision authority: IC.
2. **Scope** â€” Security/Data team computes affected-user count, affected data categories, and time window.
3. **Status page** â€” CS Lead publishes a holding statement to status.funelai.com within **10 minutes of detection**:

> **Investigating** â€” {timestamp}
> We are investigating a {scenario_class} incident affecting FunelAI. We will post the next update within 30 minutes.

4. **Internal heads-up** â€” Slack ping to `#everyone-at-funnel`: "Active SEV1, customer comms will be coordinated by CS Lead. Do not post externally."
5. **Social media monitor** â€” Trust & Safety designates one person to watch Twitter/X, Reddit, community for organic disclosure.

### Minute 15â€“20 â€” Legal & insurance contact

By minute 20:

1. **Legal counsel** is on the war room bridge. IC briefs them in 90 seconds: scope, data categories, regulatory clocks.
2. **Cyber/E&O insurance carrier** is notified by the founder or CFO. The notification is documented in the incident log. Failure to notify promptly can void coverage.
3. **Regulatory clock check:**
   - **GDPR Article 33** â€” 72 hours from awareness if personal data of EU/EEA residents is involved. Clock confirmed start time logged.
   - **FTC** â€” counsel decides notification path based on deception or unfair-practice risk.
   - **State AG breach statutes** â€” counsel triages applicable states.
   - **Payment network rules** â€” Head of Finance / Founder coordinates with processor liaison if payments involved.
   - **SEC/disclosure obligations** â€” counsel decides materiality threshold; relevant if we're publicly traded or have material contracts.

### Minute 20â€“25 â€” Board notification

By minute 25:

1. **Board chair** receives a phone call from the founder. Script:

> "It's {founder_name}. We have an active CRITICAL incident â€” {one_sentence_summary}. Scope is {scope}. Containment status is {containment}. Legal counsel is engaged. Insurance carrier is notified. Customer notification will go out within {hours} hours. I'll send a written briefing within the hour and a board call by EOD if needed."

2. **Full board** receives a written briefing (template at {board_briefing_template}) within 60 minutes.
3. **Investor notification** â€” for CRITICAL incidents with possible material impact, lead investors are notified by the founder via the agreed-upon channel.

### Minute 25â€“30 â€” Customer comms decision

By minute 30, the **founder + Legal + CS Lead** make the call on customer comms:

1. **Severity confirmation.** Final classification for this incident.
2. **Template selection.** Pull the corresponding template from Section 3.
3. **Recipient list scoped** â€” exact user IDs, locked at this moment for audit. No "we'll add to it later."
4. **Approval routing:**
   - CRITICAL: founder approves the final text, legal counsel approves the legal language, CS Lead approves the customer-experience tone.
   - All three approvals logged in the incident log with timestamps.
5. **Send window decided.**
   - If GDPR 72-hour clock running: send within 24 hours regardless of full forensic completeness; explicitly say "this is what we know now, more to come."
   - Otherwise: send within 6 hours.
6. **Status page** receives the substantive update by minute 30:

> **Identified â€” {timestamp}**
> We have identified a {scenario_class} incident affecting {scope_summary}. We are notifying affected customers by email. Next update within {next_update_interval}.

### After 30 minutes â€” handoff to extended response

The IC hands off to an **Extended Incident Lead** (usually the founder or Head of Eng), who runs:

- Hourly status page updates until containment is fully resolved
- Daily customer email updates for the first 7 days
- Weekly updates until the post-mortem is published
- Day-14 (or Day-30 for CRITICAL) **public post-mortem** at funelai.com/incidents/{id}
- Post-mortem retrospective with the team (no-blame) within 5 business days
- Action items tracked in a public-to-the-team OKR until complete

### Who calls who â€” quick reference

| Role | Contact | When |
|---|---|---|
| Incident Commander | First senior eng on-call (rotation in PagerDuty) | Minute 0 |
| Founder/CEO | {founder_cell} | Minute 5 |
| Head of Engineering | {head_eng_cell} | Minute 5 |
| Head of Trust & Safety | {head_ts_cell} | Minute 5 |
| Legal counsel | {legal_hotline} (24/7) | Minute 15 |
| Cyber insurance carrier | {carrier_hotline} | Minute 20 |
| Board chair | personally by founder | Minute 25 |
| Full board | written briefing | Minute 60 |
| Press / PR firm | {pr_firm_hotline} | Only when going public â€” coordinated by founder + legal |

### What to publish to the status page, when

| Time | Status page state | Content |
|---|---|---|
| Minute 10 | Investigating | Holding statement, next update in 30 min |
| Minute 30 | Identified | Substantive description of scenario class, affected scope, next update in 60 min |
| Hour 1+ | Mitigating / Monitoring | Updates every 60 min until resolved |
| Resolved | Resolved | Brief summary; link to public post-mortem within 14 days |

### When NOT to send the templates as-is

- If the situation is still evolving and a sent template would become inaccurate within hours â†’ wait for the next factual milestone, but always send a holding email within 24 hours acknowledging the incident.
- If counsel believes the language creates undue admission of liability â†’ revise with counsel before sending.
- If sending to affected users would tip off an active adversary still in our systems â†’ coordinate with security and law enforcement on timing.

### Pre-CRITICAL "warm" state

A pre-staged channel `#incident-comms-staged` is always populated with:

- Current on-call IC and contact info
- Founder's mobile and travel status
- Legal counsel's after-hours contact
- Insurance carrier policy number and 24/7 contact
- Status page admin credentials (in 1Password vault {vault_name})
- Press list and PR firm contact
- A blank Google Doc incident log template

Anyone in the company can look this up at any time. Quarterly tabletop exercises verify it's current.

---

## 5. Maintenance

- **Quarterly review** by Founder + Head of T&S + Legal counsel. Update templates for accuracy, regulatory changes, and lessons learned.
- **After every CRITICAL** incident, the relevant template gets revised based on what actually worked.
- **Annual tabletop exercise** â€” full simulation of a CRITICAL incident, including paging the founder, legal, and insurance carrier. The result is a published internal scorecard.
- **Template version control** â€” every template is in this Markdown file and in source control. PRs to update require Founder + Legal review.

---

## 6. Appendices

- **A. Regulatory clock cheat sheet:** GDPR 72h, sector-specific (HIPAA 60d, GLBA, COPPA), state breach statutes by state with day counts. Maintained by counsel.
- **B. Insurance carrier contact card:** policy numbers, claim numbers, escalation matrix. In `#incident-comms-staged`.
- **C. Press kit:** founder bio, company facts, prior-incident transparency record, press-firm contact. At /press-kit.
- **D. Pre-approved customer-protection commitments:** what we can promise in real time without further approval (e.g., "we will pay for your legal response to complaints arising from this incident"). Founder + counsel pre-approved list.
- **E. Industry-specific overlays for the 30 verticals** â€” some industries have additional notification obligations (e.g., financial-services adjacent, health-adjacent). Maintained alongside 06a industry overlays.
