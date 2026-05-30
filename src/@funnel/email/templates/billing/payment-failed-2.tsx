import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface PaymentFailed2Props {
  amount_usd: number;
  retry_at: string;
  update_url: string;
}

export function PaymentFailed2({ amount_usd, retry_at, update_url }: PaymentFailed2Props): React.ReactElement {
  return (
    <Layout preheader="Second attempt failed. Update your card.">
      <Heading>Second payment attempt failed</Heading>
      <Para>
        We couldn't charge <strong>${amount_usd}</strong>. We'll try once more on {retry_at}.
      </Para>
      <PrimaryButton href={update_url}>Update card now</PrimaryButton>
      <Muted>After the third failure we'll have to pause service.</Muted>
    </Layout>
  );
}
