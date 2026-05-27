import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface MfaDisabledProps {
  first_name?: string;
  factor: "totp" | "webauthn";
  reenable_url: string;
}

export function MfaDisabled({ first_name, factor, reenable_url }: MfaDisabledProps): React.ReactElement {
  return (
    <Layout preheader="If this wasn't you, lock your account now.">
      <Heading>2FA was turned off</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}we disabled two-factor auth ({factor})
        on your account.
      </Para>
      <PrimaryButton href={reenable_url}>Re-enable 2FA</PrimaryButton>
      <Muted>If this wasn't you, contact support.</Muted>
    </Layout>
  );
}
