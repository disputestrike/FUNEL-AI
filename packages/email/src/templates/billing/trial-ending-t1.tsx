import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface TrialEndingT1Props {
  first_name?: string;
  trial_ends_at: string;
  plan: string;
  amount_usd: number;
  billing_url: string;
}

export function TrialEndingT1(props: TrialEndingT1Props): React.ReactElement {
  return (
    <Layout preheader={`Tomorrow we charge $${props.amount_usd}.`}>
      <Heading>Your trial ends tomorrow</Heading>
      <Para>
        {props.first_name ? `Hey ${props.first_name} — ` : ""}heads-up: tomorrow your{" "}
        <strong>{props.plan}</strong> plan kicks in at <strong>${props.amount_usd}</strong>.
      </Para>
      <PrimaryButton href={props.billing_url}>Review billing</PrimaryButton>
      <Muted>Need a different plan? Switch any time before {props.trial_ends_at}.</Muted>
    </Layout>
  );
}
