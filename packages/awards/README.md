# @funnel/awards

Bronze → Diamond milestone awards for GoFunnelAI funnels. Implements
docs/16-viral-loops-spec.md §LOOP 3.

## Pipeline

1. **Detect.** A daily scan over funnel revenue snapshots
   (`runDailyScan`) crosses the $10K → $100K → $1M → $10M → $100M
   thresholds. Anti-gaming guards (≥10 unique customers + ≥14 days since
   publish for Bronze; refunds and chargebacks subtracted).
2. **Issue.** For each new award `issueAward()` runs the three sub-flows:
   - Generate a draft case study page at
     `gofunnelai.com/wins/<first-name>-<industry>-<tier>`.
   - Schedule physical delivery (digital / certificate / plaque /
     large plaque / crystal trophy) via the vendor adapter.
   - Send the congratulations email via Resend (`@funnel/email`).
3. **Share.** `buildShareKit()` returns OG image, badge URLs, and
   pre-filled copy for Twitter / LinkedIn / IG / Facebook so the
   winner can amplify in one tap.
4. **Publish.** Case studies are draft-by-default. The customer flips
   them to `public` from the dashboard.

## Tiers + fulfillment costs

| Tier     | Threshold     | Item         | Cost  |
|----------|---------------|--------------|-------|
| Bronze   | $10K          | Digital      | $0    |
| Silver   | $100K         | Certificate  | $25   |
| Gold     | $1M           | Plaque       | $150  |
| Platinum | $10M          | Large plaque | $500  |
| Diamond  | $100M         | Trophy       | $2000 |

## Wiring

```ts
import {
  runDailyScan,
  issueAward,
  generateCaseStudy,
  scheduleDelivery,
  buildShareKit,
  getHallOfFame,
  InMemoryAwardsStore,
} from "@funnel/awards";
```

All persistence is behind `AwardsStore` so you can swap in the real
Drizzle adapter in your app. The fulfillment vendor + email sink are
likewise injected.

## Events emitted

`milestone_hit`, `case_study_generated`, `case_study_published`,
`case_study_taken_down`, `award_shipped`, `award_delivered`.
