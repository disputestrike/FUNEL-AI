import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingWelcomeProps {
  first_name?: string;
  app_url: string;
}

export function OnboardingWelcome({ first_name, app_url }: OnboardingWelcomeProps): React.ReactElement {
  return (
    <Layout preheader="Your account's live. Let's build your first funnel.">
      <Heading>Welcome to GoFunnelAI</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}your account is live. The fastest path
        is: pick what you sell → we generate a funnel → you push it live. 60 seconds.
      </Para>
      <PrimaryButton href={app_url}>Open the app</PrimaryButton>
      <Muted>Stuck? Reply to this email — we read every one.</Muted>
    </Layout>
  );
}
