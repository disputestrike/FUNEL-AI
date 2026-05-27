# @funnel/challenge

Backend for the **7-Day Funnel Challenge** — GoFunnelAI's monthly cohort
acquisition loop. Implements docs/16-viral-loops-spec.md §LOOP 7.

## What it does

- **Monthly cohorts**: `createCohortForMonth` runs on the 1st via cron and
  flips between scheduled / running / completed.
- **Enrollment**: open to anyone with an email; account is auto-created
  on Day 2.
- **Daily curriculum** (Days 1 → 7): static manifest in `curriculum.ts`
  with email subject, preheader, SMS body, and submission type per day.
- **Daily delivery**: `sendDailyDrop` fires email (Resend) at 07:00
  local + SMS (SignalWire) at 10:00 local + auto-posts the community
  thread.
- **Progress + leaderboards**: most leads, highest CR, fastest to $1K.
  Aggregate stats fed to the cohort dashboard at
  `gofunnelai.com/challenge/<cohort_id>`.
- **Completion certificate**: PNG renders 1080×1080 + LinkedIn-format,
  emailed on Day 8 with pre-filled share posts.
- **Final-day livestream** (Zoom / YouTube Live): scheduled +
  finalized + view-join tracking.
- **Paid conversion attribution**: stamps the participant on first
  payment and emits `challenge_paid_conversion`.

## Wiring

```ts
import {
  createCohortForMonth,
  enrollParticipant,
  sendDailyDrop,
  markDayCompleted,
  buildCohortDashboard,
  issueCertificate,
  scheduleFinalStream,
  recordPaidConversion,
  InMemoryChallengeStore,
} from "@funnel/challenge";
```

Inject your concrete `EmailSink` (Resend), `SmsSink` (SignalWire),
`CommunityBotSink`, `CertificateRenderer`, and `StreamProviderAdapter`.

## Events emitted

`challenge_enrolled`, `challenge_daily_completed`,
`challenge_funnel_shipped`, `challenge_first_lead`,
`challenge_completed`, `challenge_certificate_issued`,
`challenge_paid_conversion`, `challenge_streamed_view`,
`cohort_created`, `cohort_started`, `cohort_completed`.
