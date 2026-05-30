import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface SubscriptionCanceledProps {
  active_through: string;
  reactivate_url: string;
}

export function SubscriptionCanceled({ active_through, reactivate_url }: SubscriptionCanceledProps): React.ReactElement {
  return (
    <Layout preheader={`Active through ${active_through}. No more charges.`}>
      <Heading>Subscription cancelled</Heading>
      <Para>
        Your subscription is set to end on <strong>{active_through}</strong>. You'll keep
        access until then. No further charges.
      </Para>
      <PrimaryButton href={reactivate_url}>Reactivate</PrimaryButton>
      <Muted>Door's open. Reply with what we could've done better.</Muted>
    </Layout>
  );
}
