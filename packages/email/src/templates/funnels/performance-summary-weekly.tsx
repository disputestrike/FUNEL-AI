import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface PerformanceSummaryWeeklyProps {
  leads: number;
  bookings: number;
  pipeline_usd: number;
  top_funnel_name: string;
  dashboard_url: string;
}

export function PerformanceSummaryWeekly(props: PerformanceSummaryWeeklyProps): React.ReactElement {
  return (
    <Layout preheader={`${props.leads} leads, ${props.bookings} booked, $${props.pipeline_usd.toLocaleString()} pipeline.`}>
      <Heading>Your weekly performance summary</Heading>
      <Para>
        <strong>{props.leads}</strong> leads. <strong>{props.bookings}</strong> booked.{" "}
        <strong>${props.pipeline_usd.toLocaleString()}</strong> in projected pipeline.
      </Para>
      <Para>
        Top funnel this week: <strong>{props.top_funnel_name}</strong>.
      </Para>
      <PrimaryButton href={props.dashboard_url}>Open dashboard</PrimaryButton>
      <Muted>This summary lands every Monday at 7am local.</Muted>
    </Layout>
  );
}
