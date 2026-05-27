import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface WeeklyPerformanceSummaryProps {
  leads: number;
  bookings: number;
  pipeline_usd: number;
  best_funnel_name: string;
  best_funnel_lift_pct: number;
  dashboard_url: string;
}

export function WeeklyPerformanceSummary(props: WeeklyPerformanceSummaryProps): React.ReactElement {
  return (
    <Layout preheader={`${props.leads} leads, ${props.bookings} booked, $${props.pipeline_usd.toLocaleString()} pipeline.`}>
      <Heading>Your weekly summary</Heading>
      <Para>
        <strong>{props.leads}</strong> leads. <strong>{props.bookings}</strong> booked.{" "}
        <strong>${props.pipeline_usd.toLocaleString()}</strong> in projected pipeline.
      </Para>
      <Para>
        Best funnel: <strong>{props.best_funnel_name}</strong> (
        +{props.best_funnel_lift_pct.toFixed(0)}% vs last week).
      </Para>
      <PrimaryButton href={props.dashboard_url}>See full report</PrimaryButton>
      <Muted>Lands every Monday at 7am local.</Muted>
    </Layout>
  );
}
