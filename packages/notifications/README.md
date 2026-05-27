# @funnel/notifications

Multi-channel notification engine for GoFunnelAI. Single entrypoint `notify()`
fans out to in-app, email (Resend), push (Expo/APN/FCM), SMS (SignalWire),
Slack, and Discord based on per-user preferences and workspace-owner
overrides.

## What it does

- **`notify(workspace_id, user_id, event_type, payload)`** —
  - Looks up the declarative event → channels + template map.
  - Checks user prefs + workspace-owner override.
  - Honors SMS opt-in + TCPA quiet hours (08:00–21:00 local).
  - Defers digestable events to hourly / daily buckets when the user picks
    that cadence.
  - Persists every send + every decision to an audit table.
- **Owner overrides** — workspace owners can mute event_types for everyone
  in the workspace EXCEPT billing + security events (`isOwnerMutable`).
- **Retry policy** — 3 attempts, exponential backoff (30s / 5m / 30m),
  then DLQ.
- **Digest** — `deferToDigest` + `sendDigest` for the daily/hourly cron.
- **Admin resend** — support tool to manually rerun a failed delivery.

## Channels

| Channel | Provider | Notes |
|---|---|---|
| `in_app` | DB row + websocket broadcaster | Always available |
| `email` | **Resend** | NEVER SendGrid |
| `push` | Expo / APN / FCM | Multi-device fan-out |
| `sms` | **SignalWire** | NEVER Twilio, opt-in only, TCPA quiet hours enforced |
| `slack` | webhook URL | Agency+ |
| `discord` | webhook URL | Agency+ |

## Events emitted

Audit rows for every send / skip / defer / fail decision.
