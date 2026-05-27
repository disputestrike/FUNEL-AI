import * as React from "react";
import { Heading, Layout, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingFirstFunnelReminderProps {
  first_name?: string;
  grader_url: string;
}

export function OnboardingFirstFunnelReminder({ first_name, grader_url }: OnboardingFirstFunnelReminderProps): React.ReactElement {
  return (
    <Layout preheader="Let's build your first funnel — 60 seconds.">
      <Heading>Let's build your first funnel</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}plug in what you sell and we'll generate the
        whole funnel for you. You can edit anything before publishing.
      </Para>
      <PrimaryButton href={grader_url}>Generate my funnel</PrimaryButton>
    </Layout>
  );
}
