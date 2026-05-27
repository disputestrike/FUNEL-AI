import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface MilestoneHitProps {
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  amount_usd: number;
  time_to_milestone_days: number;
  case_study_url: string;
}

const TIER_LABEL = {
  bronze: "Bronze ($10K)",
  silver: "Silver ($100K)",
  gold: "Gold ($1M)",
  platinum: "Platinum ($10M)",
  diamond: "Diamond ($100M)",
} as const;

export function MilestoneHit({ tier, amount_usd, time_to_milestone_days, case_study_url }: MilestoneHitProps): React.ReactElement {
  return (
    <Layout preheader={`You crossed $${amount_usd.toLocaleString()}.`}>
      <Heading>{TIER_LABEL[tier]} unlocked</Heading>
      <Para>
        You crossed ${amount_usd.toLocaleString()} through one funnel in {time_to_milestone_days} days.
      </Para>
      <Para>
        We auto-built a case study page for you. It's draft — you can edit, share, or take it down.
      </Para>
      <PrimaryButton href={case_study_url}>See your case study</PrimaryButton>
      <Muted>Want a hoodie? Reply with your size.</Muted>
    </Layout>
  );
}
