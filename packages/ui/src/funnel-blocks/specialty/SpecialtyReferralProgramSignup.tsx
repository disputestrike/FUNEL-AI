import * as React from "react";
import { Users } from "lucide-react";
import { BlockShell } from "../primitives";
import { Button } from "../../primitives/button";
import type { BlockBaseProps } from "../types";

export interface SpecialtyReferralProgramSignupContent {
  headline: string;
  subhead?: string;
  reward_label?: string;
  bullets?: string[];
  cta_label?: string;
}

export interface SpecialtyReferralProgramSignupProps extends BlockBaseProps {
  content: SpecialtyReferralProgramSignupContent;
}

export function SpecialtyReferralProgramSignup({ content, sectionId, styleOverrides }: SpecialtyReferralProgramSignupProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="specialty.referral-program-signup" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-signal-200 bg-gradient-to-br from-signal-50 to-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-signal-100">
            <Users className="h-7 w-7 text-signal-700" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>
            {content.subhead && <p className="mt-2 text-body text-slate-700">{content.subhead}</p>}
            {content.reward_label && (
              <p className="mt-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-caption font-semibold text-emerald-800">
                {content.reward_label}
              </p>
            )}
            {content.bullets && (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-body-sm text-slate-700">
                {content.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            <form className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input type="email" placeholder="Your email" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-body-sm" />
              <Button type="submit" variant="primary" size="lg">{content.cta_label ?? "Join the program"}</Button>
            </form>
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
