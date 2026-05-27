import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface ApiKeyCreatedProps {
  prefix: string;
  created_by_name: string;
  revoke_url: string;
  at: string;
}

export function ApiKeyCreated({ prefix, created_by_name, revoke_url, at }: ApiKeyCreatedProps): React.ReactElement {
  return (
    <Layout preheader="An API key was created on your workspace.">
      <Heading>API key created</Heading>
      <Para>
        A new API key (<code>{prefix}…</code>) was created by {created_by_name} on {at}.
      </Para>
      <PrimaryButton href={revoke_url}>Revoke key</PrimaryButton>
      <Muted>If this wasn't expected, revoke it immediately.</Muted>
    </Layout>
  );
}
