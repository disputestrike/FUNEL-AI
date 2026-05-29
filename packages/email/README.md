# @funnel/email

Transactional email for GoFunnelAI. Resend-backed, 47 React Email
templates, mobile + dark-mode tested, suppression list, one-click
unsubscribe (RFC 8058), deliverability throttle, audit log.

## Send pipeline

```ts
import { send, ResendEmail, InMemorySuppressionStore } from "@funnel/email";

const email = new ResendEmail({ apiKey: process.env.RESEND_API_KEY! });
const suppression = new InMemorySuppressionStore();

await send(
  {
    workspace_id: "wsp_…",
    user_id: "usr_…",
    to: "ada@example.com",
    template: "milestone-hit",
    data: { tier: "bronze", amount_usd: 10_000, time_to_milestone_days: 23, case_study_url: "…" },
  },
  { email, suppression, unsubscribe_base_url: "https://gofunnelai.com" },
);
```

The pipeline:

1. Hashes the recipient and checks the suppression list.
2. Resolves the template and renders to HTML + text via React Email.
3. Builds `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) headers.
4. Dispatches via Resend; on outage, the optional `FailoverEmail` wrapper
   tries a backup provider with the same idempotency key.
5. Writes one audit row per send / suppress / failure.

## Providers

- **Resend** — primary (`ResendEmail`). NEVER SendGrid.
- **Failover** — optional, plugged via `FailoverEmail` wrapper. Caller supplies
  a backup `Email` impl (e.g., SMTP via Nodemailer).

## Templates (47)

| Category | Count | Templates |
|---|---|---|
| Auth | 8 | verify-email, password-reset, password-changed, mfa-enabled, mfa-disabled, new-device-login, email-changed, account-deletion-confirmed |
| Workspace | 7 | invitation, invitation-accepted, invitation-expired, role-changed, ownership-transfer-requested, ownership-transferred, member-removed |
| Onboarding | 7 | welcome, setup-incomplete-d2, first-funnel-reminder-d5, first-lead-reminder-d7, inactivity-d14, community-invite-d4, challenge-invite-d7 |
| Funnels | 7 | funnel-published, first-lead-captured, milestone-hit, funnel-paused, funnel-archived, ab-winner-promoted, performance-summary-weekly |
| Billing | 16 | trial-started, trial-ending-t3, trial-ending-t1, upgrade-confirmed, downgrade-confirmed, receipt, payment-failed-1/2/3, card-expiring-t30/t7, account-past-due, suspended, restored, canceled, refund-issued |
| Security | 4 | api-key-created, api-key-revoked, webhook-endpoint-changed, suspicious-activity-alert |
| Notifications | 3 | new-lead, daily-digest, weekly-performance-summary |

Every template uses `@react-email/components` and the shared `_layout.tsx`
which inlines brand tokens. Mobile + dark-mode tested.

## Deliverability

`shouldThrottle()` reads the rolling 24-hour bounce + complaint rates per
sending domain. If bounce > 5% or complaint > 0.3% the engine should drop
the throughput to 10% of cap.

`SPF / DKIM / DMARC` is configured at the Resend dashboard — see comments
in `providers/resend.ts`.
