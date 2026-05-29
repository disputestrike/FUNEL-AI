import * as React from "react";
import { Trophy } from "lucide-react";
import { BlockShell } from "../primitives";
import { Button } from "../../primitives/button";
import type { BlockBaseProps } from "../types";

export interface SpecialtyContestEntryContent {
  headline: string;
  prize_description: string;
  ends_at?: string;
  rules_url?: string;
  fields?: Array<{ name: string; label: string; type: "text" | "email" | "tel" }>;
}

export interface SpecialtyContestEntryProps extends BlockBaseProps {
  content: SpecialtyContestEntryContent;
}

export function SpecialtyContestEntry({ content, sectionId, styleOverrides }: SpecialtyContestEntryProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="specialty.contest-entry" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-xl rounded-2xl border-2 border-ember-500 bg-gradient-to-br from-ember-50 to-amber-50 p-8 text-center shadow-md">
        <Trophy className="mx-auto h-12 w-12 text-ember-600" />
        <h2 className="mt-4 font-display text-h2 font-bold text-slate-900">{content.headline}</h2>
        <p className="mt-3 text-body-lg text-slate-700">{content.prize_description}</p>
        {content.ends_at && (
          <p className="mt-2 text-caption font-semibold uppercase tracking-wider text-ember-700">
            Entries close {new Date(content.ends_at).toLocaleDateString(undefined, { dateStyle: "long" })}
          </p>
        )}
        <form className="mt-6 space-y-3 text-left">
          {(content.fields ?? [
            { name: "name", label: "Your name", type: "text" as const },
            { name: "email", label: "Email", type: "email" as const },
          ]).map((f) => (
            <input
              key={f.name}
              name={f.name}
              type={f.type}
              placeholder={f.label}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-body-sm"
            />
          ))}
          <Button type="submit" variant="primary" size="lg" fullWidth>Enter to win</Button>
        </form>
        {content.rules_url && (
          <p className="mt-3 text-caption">
            <a href={content.rules_url} className="text-slate-500 underline hover:text-signal-700">Official rules</a>
          </p>
        )}
      </div>
    </BlockShell>
  );
}
