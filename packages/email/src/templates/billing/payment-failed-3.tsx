import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface PaymentFailed3Props {
  amount_usd: number;
  pause_at: string;
  update_url: string;
}

export function PaymentFailed3({ amount_usd, pause_at, update_url }: PaymentFailed3Props): React.ReactElement {
  return (
    <Layout preheader="Final attempt failed. Service pauses tomorrow.">
      <Heading>Final payment attempt failed</Heading>
      <Para>
        We couldn't charge <strong>${amount_usd}</strong>. Service pauses on{" "}
        <strong>{pause_at}</strong> unless we get a new card.
      </Para>
      <PrimaryButton href={update_url}>Fix billing</PrimaryButton>
      <Muted>Your data stays safe — we just pause sends + generations.</Muted>
    </Layout>
  );
}
