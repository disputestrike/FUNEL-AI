import * as React from "react";
import { Heading, Layout, Para, PrimaryButton } from "../_layout.js";

export interface WorkspaceInvitationExpiredProps {
  workspace_name: string;
  resend_url: string;
}

export function WorkspaceInvitationExpired({ workspace_name, resend_url }: WorkspaceInvitationExpiredProps): React.ReactElement {
  return (
    <Layout preheader="Want a new one?">
      <Heading>Your invite to {workspace_name} expired</Heading>
      <Para>Ask the workspace owner to resend it, or click below.</Para>
      <PrimaryButton href={resend_url}>Request a new invite</PrimaryButton>
    </Layout>
  );
}
