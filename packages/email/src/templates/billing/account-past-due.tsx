import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface AccountPastDueProps {
  amount_owed_usd: number;
  update_url: string;
}

export function AccountPastDue({ amount_owed_usd, update_url }: AccountPastDueProps): React.ReactElement {
  return (
    <Layout preheader="Your account is past due.">
      <Heading>Your account is past due</Heading>
      <Para>
        We owe each other clarity here. Balance owed: <strong>${amount_owed_usd}</strong>.
      </Para>
      <PrimaryButton href={update_url}>Resolve now</PrimaryButton>
      <Muted>Sends + generations stay paused until balance clears.</Muted>
    </Layout>
  );
}
