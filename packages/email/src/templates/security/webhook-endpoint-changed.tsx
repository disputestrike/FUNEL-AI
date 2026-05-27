import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface WebhookEndpointChangedProps {
  endpoint_url: string;
  changed_by_name: string;
  events_subscribed: string[];
  manage_url: string;
}

export function WebhookEndpointChanged(props: WebhookEndpointChangedProps): React.ReactElement {
  return (
    <Layout preheader="A webhook endpoint on your workspace changed.">
      <Heading>Webhook endpoint changed</Heading>
      <Para>
        Endpoint <code>{props.endpoint_url}</code> was updated by {props.changed_by_name}.
      </Para>
      <Para>Subscribed events: {props.events_subscribed.join(", ")}.</Para>
      <PrimaryButton href={props.manage_url}>Manage webhooks</PrimaryButton>
      <Muted>If this wasn't expected, audit the change immediately.</Muted>
    </Layout>
  );
}
