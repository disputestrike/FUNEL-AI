import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface TrialStartedProps {
  first_name?: string;
  trial_ends_at: string;
  app_url: string;
}

export function TrialStarted({ first_name, trial_ends_at, app_url }: TrialStartedProps): React.ReactElement {
  return (
    <Layout preheader="Your trial is live.">
      <Heading>Your trial is live</Heading>
      <Para>
        {first_name ? `Welcome, ${first_name}. ` : ""}You're free to use everything until{" "}
        <strong>{trial_ends_at}</strong>. After that, your plan auto-activates.
      </Para>
      <PrimaryButton href={app_url}>Open the app</PrimaryButton>
      <Muted>No charges yet. Cancel any time before {trial_ends_at}.</Muted>
    </Layout>
  );
}
