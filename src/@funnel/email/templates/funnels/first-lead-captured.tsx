import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface FirstLeadCapturedProps {
  lead_name: string;
  lead_location?: string;
  inbox_url: string;
}

export function FirstLeadCaptured({ lead_name, lead_location, inbox_url }: FirstLeadCapturedProps): React.ReactElement {
  return (
    <Layout preheader={`${lead_name} from ${lead_location ?? "your funnel"} just signed up. RevTry is calling them now.`}>
      <Heading>You got your first lead 🎉</Heading>
      <Para>
        {lead_name}{lead_location ? ` from ${lead_location}` : ""} just signed up.
        RevTry is calling them right now.
      </Para>
      <PrimaryButton href={inbox_url}>See the lead</PrimaryButton>
      <Muted>Real milestone. Tell your team.</Muted>
    </Layout>
  );
}
