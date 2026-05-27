import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface NewDeviceLoginProps {
  first_name?: string;
  location?: string;
  device?: string;
  ip?: string;
  at: string;
  secure_url: string;
}

export function NewDeviceLogin(props: NewDeviceLoginProps): React.ReactElement {
  return (
    <Layout preheader="Was this you? If not, secure your account in one click.">
      <Heading>New login from {props.location ?? "an unknown location"}</Heading>
      <Para>
        We saw a sign-in {props.device ? `from ${props.device}` : ""} on {props.at}
        {props.ip ? ` (IP ${props.ip})` : ""}.
      </Para>
      <Para>If that was you, you're good. If not, lock the account now.</Para>
      <PrimaryButton href={props.secure_url}>That wasn't me</PrimaryButton>
      <Muted>We'll never ask you for a password by email.</Muted>
    </Layout>
  );
}
