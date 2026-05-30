import * as React from "react";
import { Heading, Layout, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingChallengeInviteProps {
  first_name?: string;
  challenge_url: string;
  cohort_starts_at: string;
}

export function OnboardingChallengeInvite({ first_name, challenge_url, cohort_starts_at }: OnboardingChallengeInviteProps): React.ReactElement {
  return (
    <Layout preheader="7 days. One funnel. Done.">
      <Heading>Try the 7-Day Funnel Challenge</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}free, cohort-based, 7 days. The next cohort
        starts {cohort_starts_at}.
      </Para>
      <PrimaryButton href={challenge_url}>Join the challenge</PrimaryButton>
    </Layout>
  );
}
