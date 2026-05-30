import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface UpgradeConfirmedProps {
  plan: string;
  monthly_usd: number;
  proration_usd: number;
  next_charge_at: string;
  receipt_url: string;
}

export function UpgradeConfirmed(props: UpgradeConfirmedProps): React.ReactElement {
  return (
    <Layout preheader={`Your plan upgraded to ${props.plan} — welcome to more.`}>
      <Heading>Your plan upgraded to {props.plan}</Heading>
      <Para>
        <strong>${props.monthly_usd}/mo</strong>. We charged a prorated{" "}
        <strong>${props.proration_usd.toFixed(2)}</strong> today. Next charge:{" "}
        {props.next_charge_at}.
      </Para>
      <PrimaryButton href={props.receipt_url}>View receipt</PrimaryButton>
      <Muted>Need a hand? Reply and we'll help.</Muted>
    </Layout>
  );
}
