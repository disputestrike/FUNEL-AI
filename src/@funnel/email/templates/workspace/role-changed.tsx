import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface WorkspaceRoleChangedProps {
  workspace_name: string;
  from_role: string;
  to_role: string;
  actor_name: string;
}

export function WorkspaceRoleChanged({ workspace_name, from_role, to_role, actor_name }: WorkspaceRoleChangedProps): React.ReactElement {
  return (
    <Layout preheader={`Your role in ${workspace_name} changed.`}>
      <Heading>Your role changed</Heading>
      <Para>
        In <strong>{workspace_name}</strong>, your role changed from <em>{from_role}</em> to{" "}
        <em>{to_role}</em>.
      </Para>
      <Muted>Changed by {actor_name}.</Muted>
    </Layout>
  );
}
