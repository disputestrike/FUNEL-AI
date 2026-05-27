import * as React from "react";
import { Heading, Layout, Para, PrimaryButton } from "../_layout.js";

export interface WorkspaceInvitationAcceptedProps {
  member_name: string;
  workspace_name: string;
  team_url: string;
}

export function WorkspaceInvitationAccepted({ member_name, workspace_name, team_url }: WorkspaceInvitationAcceptedProps): React.ReactElement {
  return (
    <Layout preheader={`${member_name} joined your workspace.`}>
      <Heading>{member_name} joined {workspace_name}</Heading>
      <Para>You can set their permissions any time from team settings.</Para>
      <PrimaryButton href={team_url}>Manage team</PrimaryButton>
    </Layout>
  );
}
