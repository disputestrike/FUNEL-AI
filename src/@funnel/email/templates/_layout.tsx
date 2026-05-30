/**
 * Shared layout for every GoFunnelAI transactional email.
 *
 * Tokenized, mobile-first, dark-mode-safe. Re-used by all 47 templates.
 */

import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { BRAND, TOKENS } from "../brand.js";

export interface LayoutProps {
  preheader: string;
  children: React.ReactNode;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export function Layout(props: LayoutProps): React.ReactElement {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Preview>{props.preheader}</Preview>
      <Body style={{ backgroundColor: TOKENS.color.bg_alt, fontFamily: TOKENS.font.sans, color: TOKENS.color.text, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ paddingBottom: 24 }}>
            <Link href={BRAND.site_url}>
              <Img src={BRAND.logo_wordmark_url} alt="GoFunnelAI" width="120" height="28" />
            </Link>
          </Section>
          <Section style={{
            backgroundColor: TOKENS.color.bg,
            borderRadius: TOKENS.radius.lg,
            padding: "32px",
            border: `1px solid ${TOKENS.color.border}`,
          }}>
            {props.children}
          </Section>
          <Hr style={{ borderColor: TOKENS.color.border, margin: "24px 0" }} />
          <Section>
            <Text style={{ fontSize: 12, color: TOKENS.color.text_muted, lineHeight: 1.5, margin: 0 }}>
              {BRAND.address}<br />
              Replies go to{" "}
              <Link href={`mailto:${BRAND.support_email}`} style={{ color: TOKENS.color.link }}>
                {BRAND.support_email}
              </Link>.
              {props.showUnsubscribe && props.unsubscribeUrl && (
                <>
                  {" "}
                  <Link href={props.unsubscribeUrl} style={{ color: TOKENS.color.link }}>
                    Unsubscribe
                  </Link>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export interface PrimaryButtonProps {
  href: string;
  children: React.ReactNode;
}

export function PrimaryButton(props: PrimaryButtonProps): React.ReactElement {
  return (
    <Link
      href={props.href}
      style={{
        display: "inline-block",
        backgroundColor: TOKENS.color.primary,
        color: "#FFFFFF",
        padding: "12px 24px",
        borderRadius: TOKENS.radius.md,
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 14,
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      {props.children}
    </Link>
  );
}

export function Heading({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Text style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, margin: "0 0 12px 0", color: TOKENS.color.text }}>
      {children}
    </Text>
  );
}

export function Para({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Text style={{ fontSize: 16, lineHeight: 1.55, margin: "0 0 12px 0", color: TOKENS.color.text }}>
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Text style={{ fontSize: 13, lineHeight: 1.45, margin: "0 0 8px 0", color: TOKENS.color.text_muted }}>
      {children}
    </Text>
  );
}
