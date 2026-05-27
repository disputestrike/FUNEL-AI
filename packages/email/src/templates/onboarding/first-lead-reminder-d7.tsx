import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingFirstLeadReminderProps {
  first_name?: string;
  funnel_url: string;
}

export function OnboardingFirstLeadReminder({ first_name, funnel_url }: OnboardingFirstLeadReminderProps): React.ReactElement {
  return (
    <Layout preheader="Still waiting on lead #1?">
      <Heading>Still waiting on your first lead?</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}your funnel is live, but it's quiet.
        Most funnels need a small ad push to get their first 10 leads.
      </Para>
      <PrimaryButton href={funnel_url}>Connect an ad account</PrimaryButton>
      <Muted>Start at $10/day. We'll cap spend until you're sure.</Muted>
    </Layout>
  );
}
