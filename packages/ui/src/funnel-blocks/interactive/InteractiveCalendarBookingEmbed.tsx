import * as React from "react";
import { CalendarDays } from "lucide-react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface InteractiveCalendarBookingEmbedContent {
  headline?: string;
  subhead?: string;
  provider: "calendly" | "cal_com" | "google" | "savvycal";
  embed_url: string;
}

export interface InteractiveCalendarBookingEmbedProps extends BlockBaseProps {
  content: InteractiveCalendarBookingEmbedContent;
}

export function InteractiveCalendarBookingEmbed({ content, sectionId, styleOverrides }: InteractiveCalendarBookingEmbedProps): JSX.Element {
  return (
    <BlockShell sectionId={sectionId} sectionType="interactive.calendar-booking-embed" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-4xl">
        {content.headline && (
          <h2 className="text-center font-display text-h2 font-semibold text-slate-900">
            <CalendarDays className="mr-2 inline h-7 w-7 text-signal-600" />
            {content.headline}
          </h2>
        )}
        {content.subhead && <p className="mx-auto mt-3 max-w-2xl text-center text-body-lg text-slate-600">{content.subhead}</p>}
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <iframe
            src={content.embed_url}
            title={`${content.provider} booking calendar`}
            className="h-[720px] w-full"
            loading="lazy"
          />
        </div>
      </div>
    </BlockShell>
  );
}
