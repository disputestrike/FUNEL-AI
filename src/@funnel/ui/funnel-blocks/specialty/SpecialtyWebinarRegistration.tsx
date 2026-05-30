import * as React from "react";
import { CalendarDays, Clock, Video } from "lucide-react";
import { BlockShell } from "../primitives";
import { Button } from "../../primitives/button";
import type { BlockBaseProps, FormId } from "../types";

export interface SpecialtyWebinarRegistrationContent {
  headline: string;
  subhead?: string;
  starts_at: string;
  duration_minutes?: number;
  host_name?: string;
  form_id?: FormId;
  bullets?: string[];
}

export interface SpecialtyWebinarRegistrationProps extends BlockBaseProps {
  content: SpecialtyWebinarRegistrationContent;
}

export function SpecialtyWebinarRegistration({ content, sectionId, styleOverrides }: SpecialtyWebinarRegistrationProps): JSX.Element {
  const date = new Date(content.starts_at);
  return (
    <BlockShell sectionId={sectionId} sectionType="specialty.webinar-registration" styleOverrides={styleOverrides} className="bg-slate-900 text-white">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-signal-500/20 px-3 py-1 text-caption font-semibold text-signal-300">
            <Video className="h-3.5 w-3.5" />
            Live webinar
          </span>
          <h2 className="mt-4 font-display text-h1 font-bold">{content.headline}</h2>
          {content.subhead && <p className="mt-3 text-body-lg text-slate-300">{content.subhead}</p>}
          <ul className="mt-6 space-y-3 text-body text-slate-200">
            <li className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-signal-400" />
              <span>{date.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</span>
            </li>
            {content.duration_minutes && (
              <li className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-signal-400" />
                <span>{content.duration_minutes} minutes</span>
              </li>
            )}
            {content.host_name && (
              <li className="text-body-sm text-slate-300">Hosted by <span className="font-semibold text-white">{content.host_name}</span></li>
            )}
          </ul>
          {content.bullets && (
            <ul className="mt-6 list-disc space-y-1 pl-5 text-body-sm text-slate-300">
              {content.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
          <div className="text-h4 font-semibold">Save your seat</div>
          <form className="mt-4 space-y-3">
            <input type="text" placeholder="Your name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-body-sm" />
            <input type="email" placeholder="Email address" className="w-full rounded-md border border-slate-300 px-3 py-2 text-body-sm" />
            <Button type="submit" variant="primary" size="lg" fullWidth>Register for free</Button>
          </form>
          <p className="mt-3 text-caption text-slate-500">We'll email you the join link.</p>
        </div>
      </div>
    </BlockShell>
  );
}
