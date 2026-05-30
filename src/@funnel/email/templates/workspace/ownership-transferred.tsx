import * as React from "react";
import { Heading, Layout, Para } from "../_layout.js";

export interface WorkspaceOwnershipTransferredProps {
  workspace_name: string;
  from_user_name: string;
  to_user_name: string;
  effective_at: string;
}

export function WorkspaceOwnershipTransferred(props: WorkspaceOwnershipTransferredProps): React.ReactElement {
  return (
    <Layout preheader="Ownership transferred.">
      <Heading>Ownership transferred</Heading>
      <Para>
        Ownership of <strong>{props.workspace_name}</strong> moved from {props.from_user_name} to{" "}
        {props.to_user_name} on {props.effective_at}.
      </Para>
    </Layout>
  );
}
