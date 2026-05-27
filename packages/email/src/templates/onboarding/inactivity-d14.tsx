import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingInactivityProps {
  first_name?: string;
  app_url: string;
}

export function OnboardingInactivity({ first_name, app_url }: OnboardingInactivityProps): React.ReactElement {
  return (
    <Layout preheader="Anything we can help with?">
      <Heading>Stuck on something?</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}haven't seen you in a bit. Tell us what's
        in the way and we'll fix it (or help you sidestep it).
      </Para>
      <PrimaryButton href={app_url}>Open GoFunnelAI</PrimaryButton>
      <Muted>Or just reply with what's stuck.</Muted>
    </Layout>
  );
}
