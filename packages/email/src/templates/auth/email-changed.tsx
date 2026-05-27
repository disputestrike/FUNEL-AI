import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface EmailChangedProps {
  first_name?: string;
  new_email: string;
  old_email: string;
}

export function EmailChanged({ first_name, new_email, old_email }: EmailChangedProps): React.ReactElement {
  return (
    <Layout preheader="Your account email was updated.">
      <Heading>Your email was changed</Heading>
      <Para>
        {first_name ? `Hey ${first_name} — ` : ""}your GoFunnelAI account email changed from{" "}
        <strong>{old_email}</strong> to <strong>{new_email}</strong>.
      </Para>
      <Muted>If this wasn't you, contact support immediately.</Muted>
    </Layout>
  );
}
