import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface WorkspaceMemberRemovedProps {
  workspace_name: string;
  removed_by_name: string;
}

export function WorkspaceMemberRemoved({ workspace_name, removed_by_name }: WorkspaceMemberRemovedProps): React.ReactElement {
  return (
    <Layout preheader="You were removed from a workspace.">
      <Heading>You were removed from {workspace_name}</Heading>
      <Para>
        Your access to <strong>{workspace_name}</strong> was revoked by {removed_by_name}.
      </Para>
      <Muted>Your personal GoFunnelAI account is unchanged.</Muted>
    </Layout>
  );
}
