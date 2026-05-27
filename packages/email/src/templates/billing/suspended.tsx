import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface AccountSuspendedProps {
  reason: string;
  appeal_url: string;
}

export function AccountSuspended({ reason, appeal_url }: AccountSuspendedProps): React.ReactElement {
  return (
    <Layout preheader="Your account was suspended.">
      <Heading>Your account was suspended</Heading>
      <Para>
        Reason: <strong>{reason}</strong>. Your data is safe. You can file an appeal — most
        are decided within 5 business days.
      </Para>
      <PrimaryButton href={appeal_url}>File an appeal</PrimaryButton>
      <Muted>Replies to this email reach our T&S team directly.</Muted>
    </Layout>
  );
}
