import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../primitives/accordion";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * content.faq — Accordion of Q&As. Doc 18 B.6.2.
 */
export interface ContentFaqItem {
  question: string;
  answer_markdown: string;
}

export interface ContentFaqContent {
  headline?: string;
  items: ContentFaqItem[];
  expand_first_by_default?: boolean;
  emit_schema_markup?: boolean;
}

export interface ContentFaqProps extends BlockBaseProps {
  content: ContentFaqContent;
}

export function ContentFaq({ content, sectionId, styleOverrides }: ContentFaqProps): JSX.Element {
  const defaultValue = content.expand_first_by_default && content.items.length > 0 ? `faq-0` : undefined;
  return (
    <BlockShell sectionId={sectionId} sectionType="content.faq" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-3xl">
        {content.headline && (
          <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("faq-headline")}>
            {content.headline}
          </h2>
        )}
        <Accordion type="single" collapsible defaultValue={defaultValue} className="mt-8">
          {content.items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-line text-body text-slate-700">{item.answer_markdown}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {content.emit_schema_markup && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: content.items.map((i) => ({
                  "@type": "Question",
                  name: i.question,
                  acceptedAnswer: { "@type": "Answer", text: i.answer_markdown },
                })),
              }),
            }}
          />
        )}
      </div>
    </BlockShell>
  );
}
