import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface CardExpiringT7Props {
  card_last4: string;
  expires_at: string;
  update_url: string;
}

export function CardExpiringT7({ card_last4, expires_at, update_url }: CardExpiringT7Props): React.ReactElement {
  return (
    <Layout preheader="Your card expires in a week.">
      <Heading>Your card expires in a week</Heading>
      <Para>
        Card ending <strong>{card_last4}</strong> expires {expires_at}. Update now to avoid
        a paused account.
      </Para>
      <PrimaryButton href={update_url}>Update card</PrimaryButton>
      <Muted>One click — usually takes 30 seconds.</Muted>
    </Layout>
  );
}
