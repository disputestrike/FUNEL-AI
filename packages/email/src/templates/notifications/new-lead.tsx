import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface NewLeadProps {
  lead_name: string;
  lead_location?: string;
  funnel_name: string;
  inbox_url: string;
}

export function NewLead({ lead_name, lead_location, funnel_name, inbox_url }: NewLeadProps): React.ReactElement {
  return (
    <Layout preheader={`${lead_name} just submitted ${funnel_name}.`}>
      <Heading>New lead — {lead_name}</Heading>
      <Para>
        {lead_name}{lead_location ? ` from ${lead_location}` : ""} submitted{" "}
        <strong>{funnel_name}</strong>. RevTry is calling them.
      </Para>
      <PrimaryButton href={inbox_url}>See the lead</PrimaryButton>
      <Muted>Want fewer of these? Switch to a daily digest in notification settings.</Muted>
    </Layout>
  );
}
