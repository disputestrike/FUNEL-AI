import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface PaymentFailed1Props {
  amount_usd: number;
  card_last4?: string;
  update_url: string;
  retry_at: string;
}

export function PaymentFailed1({ amount_usd, card_last4, update_url, retry_at }: PaymentFailed1Props): React.ReactElement {
  return (
    <Layout preheader="Card declined. 7 days to update before service pauses.">
      <Heading>Payment failed — quick fix</Heading>
      <Para>
        We couldn't charge <strong>${amount_usd}</strong>
        {card_last4 ? ` on the card ending ${card_last4}` : ""}. We'll retry on {retry_at}.
      </Para>
      <PrimaryButton href={update_url}>Update card</PrimaryButton>
      <Muted>No service interruption yet. We've got 7 days to sort it.</Muted>
    </Layout>
  );
}
