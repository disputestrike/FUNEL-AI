import * as React from "react";
import { Heading, Layout, Muted, Para, PrimaryButton } from "../_layout.js";

export interface SuspiciousActivityAlertProps {
  description: string;
  secure_url: string;
}

export function SuspiciousActivityAlert({ description, secure_url }: SuspiciousActivityAlertProps): React.ReactElement {
  return (
    <Layout preheader="Suspicious activity on your account.">
      <Heading>Suspicious activity on your account</Heading>
      <Para>We saw something unusual: {description}.</Para>
      <PrimaryButton href={secure_url}>Secure my account</PrimaryButton>
      <Muted>If you don't recognize this, lock the account and contact support.</Muted>
    </Layout>
  );
}
