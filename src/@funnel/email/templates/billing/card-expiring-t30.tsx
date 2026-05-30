import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface CardExpiringT30Props {
  card_last4: string;
  expires_at: string;
  update_url: string;
}

export function CardExpiringT30({ card_last4, expires_at, update_url }: CardExpiringT30Props): React.ReactElement {
  return (
    <Layout preheader="Your card expires in 30 days.">
      <Heading>Your card expires in 30 days</Heading>
      <Para>
        The card ending <strong>{card_last4}</strong> expires {expires_at}.
      </Para>
      <PrimaryButton href={update_url}>Update card</PrimaryButton>
      <Muted>One click — usually takes 30 seconds.</Muted>
    </Layout>
  );
}
