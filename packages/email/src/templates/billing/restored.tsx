import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface AccountRestoredProps {
  app_url: string;
}

export function AccountRestored({ app_url }: AccountRestoredProps): React.ReactElement {
  return (
    <Layout preheader="Your account is restored.">
      <Heading>Welcome back</Heading>
      <Para>Your account is restored. All services resume immediately.</Para>
      <PrimaryButton href={app_url}>Open GoFunnelAI</PrimaryButton>
      <Muted>Sorry for the pause.</Muted>
    </Layout>
  );
}
