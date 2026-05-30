/**
 * Award issuance orchestrator.
 *
 * Triggered by `milestone_hit`. For each new award:
 *   1. Generate the (draft) case study page.
 *   2. Schedule the physical delivery (or mark digital-only for Bronze).
 *   3. Send the congratulations email + return a share kit.
 *
 * This is the single function the milestone detector consumer wires to.
 */

import { generateCaseStudy } from "./case-study-page.js";
import type { CaseStudyDeps } from "./case-study-page.js";
import { scheduleDelivery } from "./physical-delivery.js";
import type { PhysicalDeliveryDeps } from "./physical-delivery.js";
import { buildShareKit } from "./sharing.js";
import type { ShareKit } from "./sharing.js";
import type { AwardsStore } from "./store.js";
import type { Award, AwardWinner, CaseStudyPage, PhysicalDelivery } from "./types.js";

/** Minimal email sink. The actual implementation calls @funnel/email. */
export interface EmailSink {
  send(args: {
    to: string;
    template: string;
    subject: string;
    data: Record<string, unknown>;
  }): Promise<{ message_id: string }>;
}

export interface IssuanceDeps extends CaseStudyDeps, PhysicalDeliveryDeps {
  store: AwardsStore;
  email: EmailSink;
  /** Resolve the workspace owner's email — caller knows the user → email map. */
  getOwnerEmail: (workspace_id: string) => Promise<string>;
}

export interface IssuanceResult {
  award: Award;
  caseStudy: CaseStudyPage;
  delivery: PhysicalDelivery;
  shareKit: ShareKit;
}

export async function issueAward(
  args: { award: Award; winner: AwardWinner },
  deps: IssuanceDeps,
): Promise<IssuanceResult> {
  const caseStudy = await generateCaseStudy(args, deps);
  const delivery = await scheduleDelivery(args, deps);
  const shareKit = buildShareKit({ award: args.award, winner: args.winner, caseStudy });

  const to = await deps.getOwnerEmail(args.award.workspace_id);
  const subjectByTier = {
    bronze: `You crossed $10K — your Bronze award is here`,
    silver: `You crossed $100K — your Silver certificate is shipping`,
    gold: `You crossed $1M — your Gold plaque is on the way`,
    platinum: `You crossed $10M — let's talk FunnelCon`,
    diamond: `You crossed $100M — congratulations`,
  } as const;
  await deps.email.send({
    to,
    template: "milestone-hit",
    subject: subjectByTier[args.award.tier],
    data: {
      tier: args.award.tier,
      revenue_cents: args.award.revenue_at_milestone_cents,
      time_to_milestone_days: args.award.time_to_milestone_days,
      case_study_url: shareKit.links.case_study_url,
      share_kit: shareKit,
    },
  });
  return { award: args.award, caseStudy, delivery, shareKit };
}
