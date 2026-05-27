import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface DailyDigestItem {
  event_type: string;
  payload: Record<string, unknown>;
  ts: string;
}

export interface DailyDigestProps {
  items: DailyDigestItem[];
  count: number;
  app_url: string;
}

export function DailyDigest({ items, count, app_url }: DailyDigestProps): React.ReactElement {
  return (
    <Layout preheader={`${count} updates from GoFunnelAI today.`}>
      <Heading>Your daily digest — {count} updates</Heading>
      {items.slice(0, 12).map((it, i) => (
        <Para key={i}>
          • <strong>{labelFor(it.event_type)}</strong> — {String(it.payload.summary ?? "")}
        </Para>
      ))}
      {items.length > 12 ? <Para>...and {items.length - 12} more in your inbox.</Para> : null}
      <PrimaryButton href={app_url}>Open dashboard</PrimaryButton>
      <Muted>Want these in real-time instead? Switch in notification settings.</Muted>
    </Layout>
  );
}

function labelFor(event_type: string): string {
  return event_type.replace(/_/g, " ");
}
