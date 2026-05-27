import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface AbWinnerPromotedProps {
  funnel_name: string;
  winner_variant: string;
  loser_variant: string;
  lift_pct: number;
  data_url: string;
}

export function AbWinnerPromoted({ funnel_name, winner_variant, loser_variant, lift_pct, data_url }: AbWinnerPromotedProps): React.ReactElement {
  return (
    <Layout preheader={`Variant ${winner_variant} beats ${loser_variant} by ${lift_pct.toFixed(0)}%.`}>
      <Heading>A/B winner promoted</Heading>
      <Para>
        On <strong>{funnel_name}</strong>, variant <strong>{winner_variant}</strong> beat{" "}
        <strong>{loser_variant}</strong> by <strong>{lift_pct.toFixed(0)}%</strong>. We promoted
        it as the default.
      </Para>
      <PrimaryButton href={data_url}>See the data</PrimaryButton>
      <Muted>You can revert any time.</Muted>
    </Layout>
  );
}
