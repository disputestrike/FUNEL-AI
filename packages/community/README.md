# @funnel/community

Community + gamification layer for GoFunnelAI. Implements docs/16-viral-loops-spec.md §LOOP 5.

## What it does

- **35 hubs**: 30 industry + 5 stage hubs (`buildHubCatalog`).
- **Posts**: CRUD, daily themed threads (Win Wed, Fail Fri, Question Mon, AMA Tue, Tactic Thu, Show-Off Sat, Sunday Setup). Themed threads earn 2× XP for the first 24h.
- **XP rules**: ship funnel (10), first lead (50), first $1K (200), upvoted answer (5), mentor-mentee first lead (100), win challenge (500), featured (250). Daily caps to defeat farming.
- **Levels L1 → L10** with unlock thresholds (`levels.ts`).
- **Mentor matching**: L7+ opt-in, matched on industry + geo + stage with load + freshness factors. Mentor XP fires only when mentee hits `first_lead` (verified via Match row).
- **Monthly Funnel Games**: $5K (early) → $25K (mature) prize pools with predefined breakdowns. Eligibility L4+.
- **Anti-farming**: cross-referenced source verification + per-day caps.
- **Skool bridge** (Months 1–6): SSO + level-badge push + post mirror for the 90-day dual-run window during the native migration.

## Wiring

```ts
import {
  buildHubCatalog,
  createPost,
  dropThemedThread,
  grantXp,
  levelForXp,
  scoreMentor,
  findBestMatch,
  scheduleGame,
  enterGame,
  closeGame,
  syncUserToSkool,
  InMemoryCommunityStore,
} from "@funnel/community";
```

Storage is behind `CommunityStore` so you can swap in the Drizzle adapter. The Skool client is injected.

## Events emitted

`community_member_joined`, `xp_earned`, `level_up`, `post_created`,
`post_reacted`, `comment_upvoted`, `mentor_matched`,
`mentor_relationship_ended`, `mentee_first_lead`,
`challenge_participated`, `challenge_won`, `office_hours_attended`,
`game_scheduled`, `game_closed`.
