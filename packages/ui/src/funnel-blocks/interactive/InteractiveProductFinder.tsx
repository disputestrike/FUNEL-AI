import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface ProductFinderStep {
  question: string;
  options: Array<{ value: string; label: string }>;
}

export interface ProductFinderRecommendation {
  match_key: string; // concatenated answers, joined by "|"
  title: string;
  description?: string;
  cta_label?: string;
  cta_url?: string;
}

export interface InteractiveProductFinderContent {
  headline?: string;
  subhead?: string;
  steps: ProductFinderStep[];
  recommendations: ProductFinderRecommendation[];
  fallback?: ProductFinderRecommendation;
}

export interface InteractiveProductFinderProps extends BlockBaseProps {
  content: InteractiveProductFinderContent;
}

export function InteractiveProductFinder({ content, sectionId, styleOverrides }: InteractiveProductFinderProps): JSX.Element {
  const [stepIdx, setStepIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<string[]>([]);
  const done = stepIdx >= content.steps.length;
  const matchKey = answers.join("|");
  const rec = content.recommendations.find((r) => r.match_key === matchKey) ?? content.fallback;

  return (
    <BlockShell sectionId={sectionId} sectionType="interactive.product-finder" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
        {!done && content.headline && stepIdx === 0 && (
          <h2 className="font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>
        )}
        {!done && content.steps[stepIdx] && (
          <>
            <div className="mb-4 text-caption font-semibold uppercase tracking-wider text-signal-700">
              Step {stepIdx + 1} of {content.steps.length}
            </div>
            <h3 className="text-h4 font-semibold text-slate-900">{content.steps[stepIdx]!.question}</h3>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {content.steps[stepIdx]!.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setAnswers((a) => [...a, opt.value]);
                    setStepIdx((i) => i + 1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-body-sm font-medium text-slate-900 transition hover:border-signal-500 hover:bg-signal-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
        {done && rec && (
          <div className="text-center">
            <div className="text-caption font-semibold uppercase tracking-wider text-signal-700">Your match</div>
            <h3 className="mt-2 text-h2 font-bold text-slate-900">{rec.title}</h3>
            {rec.description && <p className="mt-3 text-body text-slate-700">{rec.description}</p>}
            {rec.cta_url && (
              <a
                href={rec.cta_url}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-signal-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-signal-600"
              >
                {rec.cta_label ?? "Learn more"}
              </a>
            )}
            <button
              type="button"
              onClick={() => { setAnswers([]); setStepIdx(0); }}
              className="mt-4 block text-caption text-slate-500 underline hover:text-signal-700"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </BlockShell>
  );
}
