import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface PasswordResetProps {
  first_name?: string;
  reset_url: string;
}

export function PasswordReset({ first_name, reset_url }: PasswordResetProps): React.ReactElement {
  return (
    <Layout preheader="Expires in 30 min. Didn't ask for this? Tell us.">
      <Heading>Reset your password</Heading>
      <Para>
        Hey{first_name ? ` ${first_name}` : ""} — click below to set a new password.
      </Para>
      <PrimaryButton href={reset_url}>Reset password</PrimaryButton>
      <Muted>
        The link expires in 30 minutes. If you didn't request this, ignore it —
        nothing changes until you click.
      </Muted>
    </Layout>
  );
}
