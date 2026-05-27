import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface VerifyEmailProps {
  first_name?: string;
  verify_url: string;
}

export function VerifyEmail({ first_name, verify_url }: VerifyEmailProps): React.ReactElement {
  return (
    <Layout preheader="Click once and we're rolling — should take 4 seconds.">
      <Heading>Verify your email</Heading>
      <Para>
        Hey{first_name ? ` ${first_name}` : ""} — one click and your account's set up.
      </Para>
      <PrimaryButton href={verify_url}>Verify email</PrimaryButton>
      <Muted>This link expires in 30 minutes. Didn't sign up? Ignore this email.</Muted>
    </Layout>
  );
}
