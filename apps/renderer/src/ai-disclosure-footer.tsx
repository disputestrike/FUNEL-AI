/**
 * The AI disclosure footer — required on every published Funnel page per
 * FTC AI-marketing guidance, EU AI Act Article 50, and our own
 * Acceptable Use Policy (doc 05c).
 *
 * On free-tier plans this CANNOT be hidden — see doc 18 Â§A.5 rule #4 and
 * src/render.ts where the renderer cross-checks the workspace plan against
 * compliance.ai_disclosure_visible and refuses to hide.
 *
 * The copy itself lives here — NOT in the funnel JSON. That's intentional:
 * we want consistent, regulator-defensible language across all funnels, and
 * we want to be able to update it globally without redeploying every funnel.
 *
 * We expose the copy hash so the `ai_disclosure_rendered` event (doc 03 Â§A.9)
 * can record exactly which version of the disclosure was shown.
 */

import * as React from "react";
import { sha256Hex } from "./lib/crypto.js";

const DISCLOSURE_COPY: Record<string, { short: string; long: string }> = {
  en: {
    short: "This page was generated and personalized using AI. Some elements may be auto-optimized.",
    long: "This page was generated and personalized using artificial intelligence by GoFunnelAI. Content, images, and offers may be auto-optimized based on visitor data. Claims about results are illustrative, not guaranteed. Learn more about our AI disclosure policy.",
  },
  "en-GB": {
    short: "This page was generated and personalised using AI. Some elements may be auto-optimised.",
    long: "This page was generated and personalised using artificial intelligence by GoFunnelAI. Content, images, and offers may be auto-optimised based on visitor data. Claims about results are illustrative, not guaranteed. Learn more about our AI disclosure policy.",
  },
  es: {
    short: "Esta pÃ¡gina fue generada y personalizada con IA. Algunos elementos pueden optimizarse automÃ¡ticamente.",
    long: "Esta pÃ¡gina fue generada y personalizada con inteligencia artificial por GoFunnelAI. El contenido, imÃ¡genes y ofertas pueden optimizarse automÃ¡ticamente segÃºn los datos del visitante. Las afirmaciones sobre resultados son ilustrativas, no garantizadas.",
  },
  fr: {
    short: "Cette page a Ã©tÃ© gÃ©nÃ©rÃ©e et personnalisÃ©e Ã  l'aide de l'IA. Certains Ã©lÃ©ments peuvent Ãªtre optimisÃ©s automatiquement.",
    long: "Cette page a Ã©tÃ© gÃ©nÃ©rÃ©e et personnalisÃ©e par l'intelligence artificielle de GoFunnelAI. Le contenu, les images et les offres peuvent Ãªtre optimisÃ©s automatiquement en fonction des donnÃ©es du visiteur. Les affirmations relatives aux rÃ©sultats sont illustratives, non garanties.",
  },
  de: {
    short: "Diese Seite wurde mit KI generiert und personalisiert. Einige Elemente kÃ¶nnen automatisch optimiert werden.",
    long: "Diese Seite wurde mit kÃ¼nstlicher Intelligenz von GoFunnelAI generiert und personalisiert. Inhalte, Bilder und Angebote kÃ¶nnen basierend auf Besucherdaten automatisch optimiert werden. Aussagen zu Ergebnissen sind illustrativ, nicht garantiert.",
  },
  pt: {
    short: "Esta pÃ¡gina foi gerada e personalizada com IA. Alguns elementos podem ser otimizados automaticamente.",
    long: "Esta pÃ¡gina foi gerada e personalizada com inteligÃªncia artificial pela GoFunnelAI. ConteÃºdos, imagens e ofertas podem ser otimizados automaticamente com base nos dados do visitante. AfirmaÃ§Ãµes sobre resultados sÃ£o ilustrativas, nÃ£o garantidas.",
  },
  hi: {
    short: "à¤¯à¤¹ à¤ªà¥ƒà¤·à¥à¤  AI à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¬à¤¨à¤¾à¤¯à¤¾ à¤”à¤° à¤…à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¹à¥ˆà¥¤ à¤•à¥à¤› à¤¤à¤¤à¥à¤µ à¤¸à¥à¤µà¤šà¤¾à¤²à¤¿à¤¤ à¤°à¥‚à¤ª à¤¸à¥‡ à¤‘à¤ªà¥à¤Ÿà¤¿à¤®à¤¾à¤‡à¤œà¤¼ à¤•à¤¿à¤ à¤œà¤¾ à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤",
    long: "à¤¯à¤¹ à¤ªà¥ƒà¤·à¥à¤  GoFunnelAI à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤•à¥ƒà¤¤à¥à¤°à¤¿à¤® à¤¬à¥à¤¦à¥à¤§à¤¿à¤®à¤¤à¥à¤¤à¤¾ à¤•à¤¾ à¤‰à¤ªà¤¯à¥‹à¤— à¤•à¤°à¤•à¥‡ à¤¬à¤¨à¤¾à¤¯à¤¾ à¤”à¤° à¤…à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¹à¥ˆà¥¤ à¤¸à¤¾à¤®à¤—à¥à¤°à¥€, à¤›à¤µà¤¿à¤¯à¤¾à¤ à¤”à¤° à¤ªà¥à¤°à¤¸à¥à¤¤à¤¾à¤µ à¤µà¤¿à¤œà¤¼à¤¿à¤Ÿà¤° à¤¡à¥‡à¤Ÿà¤¾ à¤•à¥‡ à¤†à¤§à¤¾à¤° à¤ªà¤° à¤¸à¥à¤µà¤šà¤¾à¤²à¤¿à¤¤ à¤°à¥‚à¤ª à¤¸à¥‡ à¤…à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤•à¤¿à¤ à¤œà¤¾ à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤ à¤ªà¤°à¤¿à¤£à¤¾à¤®à¥‹à¤‚ à¤•à¥‡ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚ à¤¦à¤¾à¤µà¥‡ à¤•à¥‡à¤µà¤² à¤‰à¤¦à¤¾à¤¹à¤°à¤£ à¤¹à¥ˆà¤‚, à¤—à¤¾à¤°à¤‚à¤Ÿà¥€ à¤¨à¤¹à¥€à¤‚à¥¤",
  },
};

const DISCLOSURE_LEARN_MORE_URL = "https://gofunnelai.com/ai-disclosure";

export function getDisclosureCopy(locale: string): { short: string; long: string } {
  const exact = DISCLOSURE_COPY[locale];
  if (exact) return exact;
  const base = locale.split("-")[0]!;
  return DISCLOSURE_COPY[base] ?? DISCLOSURE_COPY.en!;
}

export async function disclosureCopyHash(locale: string): Promise<string> {
  const copy = getDisclosureCopy(locale);
  return sha256Hex(`v1|${locale}|${copy.short}`);
}

export interface AiDisclosureFooterProps {
  locale: string;
  /** Hide is only honored for paid plans that opt out; free tier always renders. */
  hide: boolean;
  /** Workspace plan — used to render "Powered by GoFunnelAI" on starter only. */
  poweredBy: boolean;
}

export function AiDisclosureFooter(props: AiDisclosureFooterProps): React.ReactElement | null {
  if (props.hide) return null;
  const { short } = getDisclosureCopy(props.locale);
  return (
    <div
      data-funnel-ai-disclosure="1"
      data-funnel-ai-disclosure-locale={props.locale}
      style={{
        background: "rgba(0,0,0,0.04)",
        color: "rgba(0,0,0,0.65)",
        fontSize: "12px",
        lineHeight: 1.45,
        padding: "10px 16px",
        textAlign: "center",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <span>{short} </span>
      <a
        href={DISCLOSURE_LEARN_MORE_URL}
        rel="noopener"
        target="_blank"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        Learn more
      </a>
      {props.poweredBy && (
        <>
          <span aria-hidden="true"> Â· </span>
          <a
            href="https://gofunnelai.com?utm_source=poweredby"
            rel="noopener"
            target="_blank"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            Powered by GoFunnelAI
          </a>
        </>
      )}
    </div>
  );
}
