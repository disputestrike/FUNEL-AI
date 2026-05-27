import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface TrialEndingT3Props {
  first_name?: string;
  trial_ends_at: string;
  plan: string;
  billing_url: string;
}

export function TrialEndingT3(props: TrialEndingT3Props): React.ReactElement {
  return (
    <Layout preheader="3 days left in your trial.">
      <Heading>3 days left in your trial</Heading>
      <Para>
        {props.first_name ? `Hey ${props.first_name} — ` : ""}your trial ends{" "}
        <strong>{props.trial_ends_at}</strong>. Your <strong>{props.plan}</strong> plan
        will auto-start unless you cancel.
      </Para>
      <PrimaryButton href={props.billing_url}>Review billing</PrimaryButton>
      <Muted>You can change plans any time.</Muted>
    </Layout>
  );
}
