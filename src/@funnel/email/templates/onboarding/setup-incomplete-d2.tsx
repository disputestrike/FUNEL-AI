import * as React from "react";
import { Heading, Layout, Para, PrimaryButton } from "../_layout.js";

export interface OnboardingSetupIncompleteProps {
  first_name?: string;
  resume_url: string;
}

export function OnboardingSetupIncomplete({ first_name, resume_url }: OnboardingSetupIncompleteProps): React.ReactElement {
  return (
    <Layout preheader="Two minutes to finish setup.">
      <Heading>Two minutes to finish setup</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}you started, then got pulled away.
        Pick up where you left off — it'll take two minutes.
      </Para>
      <PrimaryButton href={resume_url}>Resume setup</PrimaryButton>
    </Layout>
  );
}
