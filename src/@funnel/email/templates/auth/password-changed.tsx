import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface PasswordChangedProps {
  first_name?: string;
  changed_at: string;
  secure_url: string;
  ip?: string;
}

export function PasswordChanged({ first_name, changed_at, secure_url, ip }: PasswordChangedProps): React.ReactElement {
  return (
    <Layout preheader="If this was you, ignore. If not, lock your account now.">
      <Heading>Your password was just changed</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}we updated your password on {changed_at}
        {ip ? ` (from ${ip})` : ""}.
      </Para>
      <Para>
        If that was you, you're all set. If it wasn't, secure your account now.
      </Para>
      <PrimaryButton href={secure_url}>Secure my account</PrimaryButton>
      <Muted>All other sessions were signed out.</Muted>
    </Layout>
  );
}
