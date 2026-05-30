import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface MfaEnabledProps {
  first_name?: string;
  factor: "totp" | "webauthn";
}

export function MfaEnabled({ first_name, factor }: MfaEnabledProps): React.ReactElement {
  return (
    <Layout preheader="One more layer between you and the bad guys.">
      <Heading>2FA is on. Nice.</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}we enabled two-factor auth ({factor === "totp" ? "authenticator app" : "passkey"})
        on your account.
      </Para>
      <Muted>If you didn't do this, contact support immediately.</Muted>
    </Layout>
  );
}
