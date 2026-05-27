import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface WorkspaceInvitationProps {
  inviter_name: string;
  workspace_name: string;
  role: string;
  accept_url: string;
  expires_at: string;
}

export function WorkspaceInvitation({ inviter_name, workspace_name, role, accept_url, expires_at }: WorkspaceInvitationProps): React.ReactElement {
  return (
    <Layout preheader={`${inviter_name} invited you to ${workspace_name}.`}>
      <Heading>You're invited to {workspace_name}</Heading>
      <Para>
        {inviter_name} added you as <strong>{role}</strong>.
      </Para>
      <PrimaryButton href={accept_url}>Accept invite</PrimaryButton>
      <Muted>This invite expires {expires_at}.</Muted>
    </Layout>
  );
}
