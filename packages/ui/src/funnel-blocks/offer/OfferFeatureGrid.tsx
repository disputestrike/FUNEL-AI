import * as React from "react";
import * as Icons from "lucide-react";
import { Sparkles as SparklesIcon } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";
import { AB } from "../types";

/**
 * offer.feature-grid — A 2-4 column grid of features with icons.
 */
export interface FeatureItem {
  icon?: string; // lucide icon name
  title: string;
  description?: string;
}

export interface OfferFeatureGridContent {
  headline?: string;
  subhead?: string;
  features: FeatureItem[];
  columns?: 2 | 3 | 4;
}

export interface OfferFeatureGridProps extends BlockBaseProps {
  content: OfferFeatureGridContent;
}

function getIcon(name?: string): React.ComponentType<{ className?: string }> {
  if (!name) return SparklesIcon;
  const iconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }> | undefined>;
  return iconMap[name] ?? SparklesIcon;
}

export function OfferFeatureGrid({ content, sectionId, styleOverrides }: OfferFeatureGridProps): JSX.Element {
  const columns = content.columns ?? 3;
  const colsClass =
    columns === 2 ? "md:grid-cols-2" : columns === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <BlockShell sectionId={sectionId} sectionType="offer.feature-grid" styleOverrides={styleOverrides}>
      {content.headline && (
        <h2 className="text-center font-display text-h2 font-semibold text-slate-900" {...AB("offer-headline")}>
          {content.headline}
        </h2>
      )}
      {content.subhead && <p className="mx-auto mt-3 max-w-2xl text-center text-body-lg text-slate-600">{content.subhead}</p>}
      <ul className={`mt-10 grid grid-cols-1 gap-6 ${colsClass}`}>
        {content.features.map((f, i) => {
          const Icon = getIcon(f.icon);
          return (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-signal-100">
                <Icon className="h-6 w-6 text-signal-700" />
              </div>
              <h3 className="mt-4 text-h5 font-semibold text-slate-900">{f.title}</h3>
              {f.description && <p className="mt-2 text-body-sm text-slate-600">{f.description}</p>}
            </li>
          );
        })}
      </ul>
    </BlockShell>
  );
}
