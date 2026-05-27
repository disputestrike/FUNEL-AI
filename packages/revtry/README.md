# @funnel/revtry

RevTry voice agent — outbound dialer + inbound handler + scripts +
minutes ledger + TCPA / state-recording-law guards. Uses **SignalWire**
for telephony (NEVER Twilio).

## Pipeline

1. **placeOutboundCall** —
   - DNC hard-gate (federal, state, internal voice DNC, per-number opt-out).
   - TCPA quiet hours (08:00 – 21:00 callee-local).
   - Place via SignalWire; persist the call row.
   - Emit `revtry_call_started`.
2. **handleInbound** — answer URL handler: persist the call, play
   the recording preamble, hand off to the LLM voice runtime.
3. **recordOutcome** (status webhook) — update the call row,
   charge the minutes ledger, push to CRM, emit
   `revtry_call_completed`.

## Plan minutes

| Tier   | Per cycle |
|--------|-----------|
| Free   | 25 min    |
| Starter| 100 min   |
| Growth | 500 min   |
| Scale  | 2,500 min |
| Agency | pooled    |

Overage: **$0.18/min** — billed via `MinutesLedgerEntry.reason="overage"`.

## State + TCPA rules

- Two-party-consent states (CA, CT, DE, FL, IL, MD, MA, MT, NV, NH, PA,
  WA, OR): preamble + affirmative continued engagement; opt-out terminates.
- Federal / one-party states: preamble + customer consent suffices.
- Outbound quiet hours: no calls 21:00 → 08:00 callee local.

## Scripts

`generateScript({ workspace_id, industry, persona, language })` —
returns opener, qualifying questions, objection handlers, booking close,
voicemail variant, TCPA opt-out line, recording disclosure (en + es).
Library is keyed `industry × persona × language`; the in-package set is
the launch starter, with the full catalog living in the KB pack
(`docs/02a`).

## Consent ledger

`recordPreamble` writes an immutable row with state rule + retention
window (7 years).
