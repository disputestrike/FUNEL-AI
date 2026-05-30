import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface FunnelArchivedProps {
  funnel_name: string;
  restore_url: string;
}

export function FunnelArchived({ funnel_name, restore_url }: FunnelArchivedProps): React.ReactElement {
  return (
    <Layout preheader={`${funnel_name} archived.`}>
      <Heading>{funnel_name} was archived</Heading>
      <Para>The funnel is offline. Restore any time from your dashboard.</Para>
      <PrimaryButton href={restore_url}>Restore</PrimaryButton>
      <Muted>Data is preserved for 90 days.</Muted>
    </Layout>
  );
}
