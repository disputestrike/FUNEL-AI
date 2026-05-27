# Offer Intelligence Addendum Crosswalk

This addendum records the code-level fusion work for the "give value before the ask" requirement, industry-specific upsell staging, image/asset generation, and the eight critical gaps.

## Implementation Evidence

| Requirement | Evidence |
| --- | --- |
| Free value before ask | `packages/orchestrator/src/offer-intelligence.ts` selects an industry lead magnet before the CTA: calculator, quiz, checklist, audit, report, or template. |
| How the system knows what to give free | `INDUSTRY_OFFER_MATRIX` maps industry keywords to lead magnet format, title, promise, delivery plan, qualification fields, and proof requirements. |
| Industry-specific upsells | `upsellLadder` defines tripwire, order bump, core offer, one-click upsell, continuity, or referral steps per industry. |
| Quality graphics and assets | `creativeAssets` returns channel, slot, count, prompt, license, and review status for image/PDF/ad generation. |
| No-lift generation | `generate()` in `packages/orchestrator/src/index.ts` returns page sections, lead magnet, offer stack, upsells, assets, evidence, and quality gates in one backend payload. |
| OpenAI/Claude plus 30 Breath split | `productionPlan` records OpenAI/Claude for strategy and 30 Breath for mechanical packaging, formatting, and asset assembly. |
| Proof/crosswalk evidence | `buildOfferCrosswalk()` exposes evidence items for proof screens, admin audit, or QA review. |
| Working tests | `packages/orchestrator/tests/offer-intelligence.test.ts` verifies industry lead magnets, upsell ladders, creative manifests, crosswalk evidence, backend generation, public funnel service, and inline edits. |

## Eight Critical Gaps

| Gap | How It Is Closed |
| --- | --- |
| Customer success activation | The free asset creates the Day 0 value moment and carries qualification fields for follow-up. |
| Unit economics | Each industry has a ladder from free value to paid conversion, expansion, continuity, or referral. |
| Competitive intelligence | Proof assets and objection handlers are industry-specific, not generic page-builder copy. |
| Crisis response | Compliance notes become quality-gate evidence before publish. |
| Agency enablement | Asset manifests include license and review status for client-ready handoff. |
| International operations | Geography is retained for claims, consent, currency, and local compliance review. |
| Data provenance/governance | Every result carries matrix key and KB version. |
| Key person risk | Offer logic is encoded in reusable system logic instead of founder-only memory. |
