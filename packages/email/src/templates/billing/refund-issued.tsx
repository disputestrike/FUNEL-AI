import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface RefundIssuedProps {
  amount_usd: number;
  card_last4?: string;
  reason?: string;
}

export function RefundIssued({ amount_usd, card_last4, reason }: RefundIssuedProps): React.ReactElement {
  return (
    <Layout preheader={`Refund processed — $${amount_usd}.`}>
      <Heading>Refund processed — ${amount_usd}</Heading>
      <Para>
        ${amount_usd} is on its way back
        {card_last4 ? ` to the card ending ${card_last4}` : ""}. Most banks post it in
        5–10 business days.
      </Para>
      {reason ? <Para>Reason on file: {reason}</Para> : null}
      <Muted>We'd love to know what we could've done better — reply if you've got 30 seconds.</Muted>
    </Layout>
  );
}
