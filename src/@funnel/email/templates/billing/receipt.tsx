import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface ReceiptProps {
  plan: string;
  amount_usd: number;
  paid_at: string;
  next_charge_at: string;
  invoice_url: string;
}

export function Receipt(props: ReceiptProps): React.ReactElement {
  return (
    <Layout preheader={`Receipt for $${props.amount_usd} — ${props.plan} plan.`}>
      <Heading>Receipt for ${props.amount_usd} — {props.plan}</Heading>
      <Para>
        Paid {props.paid_at}. Next charge on {props.next_charge_at}.
      </Para>
      <PrimaryButton href={props.invoice_url}>View invoice (PDF)</PrimaryButton>
      <Muted>Thanks for building with us.</Muted>
    </Layout>
  );
}
