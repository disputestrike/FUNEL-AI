import * as React from "react";
import { Heading, Layout, Muted, Para } from "../_layout.js";

export interface DowngradeConfirmedProps {
  from_plan: string;
  to_plan: string;
  effective_at: string;
}

export function DowngradeConfirmed({ from_plan, to_plan, effective_at }: DowngradeConfirmedProps): React.ReactElement {
  return (
    <Layout preheader={`Plan change confirmed — ${to_plan}.`}>
      <Heading>Plan change confirmed</Heading>
      <Para>
        We'll move you from <strong>{from_plan}</strong> to <strong>{to_plan}</strong> on{" "}
        {effective_at}. Until then everything works the same.
      </Para>
      <Muted>You can switch back any time before that date.</Muted>
    </Layout>
  );
}
