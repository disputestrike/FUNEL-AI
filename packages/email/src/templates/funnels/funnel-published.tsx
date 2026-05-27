import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface FunnelPublishedProps {
  funnel_name: string;
  funnel_url: string;
  view_url: string;
  score?: number;
}

export function FunnelPublished({ funnel_name, funnel_url, view_url, score }: FunnelPublishedProps): React.ReactElement {
  return (
    <Layout preheader={`${funnel_name} is live${score ? ` — scored ${score}/100` : ""}.`}>
      <Heading>{funnel_name} is live</Heading>
      <Para>
        Your funnel is published at <a href={funnel_url}>{funnel_url}</a>
        {score ? ` and scored ${score}/100 on our quality rubric` : ""}.
      </Para>
      <PrimaryButton href={view_url}>View funnel</PrimaryButton>
      <Muted>Want to A/B a variant? Just hit "Polish" in the editor.</Muted>
    </Layout>
  );
}
