import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface ApiKeyRevokedProps {
  prefix: string;
  revoked_by_name: string;
  at: string;
}

export function ApiKeyRevoked({ prefix, revoked_by_name, at }: ApiKeyRevokedProps): React.ReactElement {
  return (
    <Layout preheader="An API key was revoked.">
      <Heading>API key revoked</Heading>
      <Para>
        Key (<code>{prefix}…</code>) was revoked by {revoked_by_name} on {at}.
      </Para>
      <Muted>This key cannot be re-used. Generate a new one in API settings.</Muted>
    </Layout>
  );
}
