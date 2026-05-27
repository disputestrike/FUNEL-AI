import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface WorkspaceOwnershipTransferRequestedProps {
  current_owner_name: string;
  workspace_name: string;
  confirm_url: string;
  expires_at: string;
}

export function WorkspaceOwnershipTransferRequested(props: WorkspaceOwnershipTransferRequestedProps): React.ReactElement {
  return (
    <Layout preheader="Confirm to take over ownership of the workspace.">
      <Heading>Confirm ownership transfer</Heading>
      <Para>
        {props.current_owner_name} wants to transfer ownership of <strong>{props.workspace_name}</strong> to you.
      </Para>
      <PrimaryButton href={props.confirm_url}>Accept ownership</PrimaryButton>
      <Muted>This request expires {props.expires_at}.</Muted>
    </Layout>
  );
}
