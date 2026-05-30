import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface FunnelPausedProps {
  funnel_name: string;
  reason: string;
  appeal_url: string;
}

export function FunnelPaused({ funnel_name, reason, appeal_url }: FunnelPausedProps): React.ReactElement {
  return (
    <Layout preheader="AUP flag from automated scan. Most are false positives — review in 1 click.">
      <Heading>{funnel_name} was paused for review</Heading>
      <Para>
        Our automated scan flagged the funnel. Reason: <strong>{reason}</strong>.
        Most are false positives — review usually takes under 4 hours.
      </Para>
      <PrimaryButton href={appeal_url}>Review now</PrimaryButton>
      <Muted>Hosted pages return a branded "under review" message in the meantime.</Muted>
    </Layout>
  );
}
