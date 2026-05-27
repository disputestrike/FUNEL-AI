import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface AccountDeletionConfirmedProps {
  first_name?: string;
  restore_url: string;
  purge_after: string;
}

export function AccountDeletionConfirmed({ first_name, restore_url, purge_after }: AccountDeletionConfirmedProps): React.ReactElement {
  return (
    <Layout preheader="Sorry to see you go. Your data is safe for 90 days if you change your mind.">
      <Heading>Your account was archived</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}we archived your GoFunnelAI account.
        Your data is preserved until {purge_after}.
      </Para>
      <PrimaryButton href={restore_url}>Restore my account</PrimaryButton>
      <Muted>Need a hand? Reply and we'll help.</Muted>
    </Layout>
  );
}
