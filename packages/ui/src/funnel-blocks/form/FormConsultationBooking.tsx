import * as React from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Calendar } from "../../primitives/calendar";
import { BlockShell } from "../primitives";
import type { BlockBaseProps, FormId, ResolvedForm } from "../types";
import { AB } from "../types";

/**
 * form.consultation-booking — Calendar + time picker + capture form.
 * Doc 18 B.2.7.
 */
export interface FormConsultationBookingContent {
  form_id: FormId;
  headline?: string;
  subhead?: string;
  meeting_length_minutes: number;
  time_slots_provider?: "calendly" | "cal_com" | "google" | "native";
  /** Pre-rendered slots when using the native provider. */
  available_slots?: string[]; // ISO8601
}

export type FormConsultationBookingVariant = "side-by-side" | "stepped" | "embedded";

export interface FormConsultationBookingProps extends BlockBaseProps {
  content: FormConsultationBookingContent;
  variant?: FormConsultationBookingVariant;
  onConfirm?: (form: ResolvedForm | undefined, slotIso: string) => void;
}

export function FormConsultationBooking({
  content,
  sectionId,
  resolveForm,
  styleOverrides,
  onConfirm,
}: FormConsultationBookingProps): JSX.Element {
  const form = resolveForm?.(content.form_id);
  const [date, setDate] = React.useState<Date | undefined>();
  const [slot, setSlot] = React.useState<string | undefined>();

  const slotsForDay = (content.available_slots ?? []).filter((iso) => {
    if (!date) return false;
    const d = new Date(iso);
    return d.toDateString() === date.toDateString();
  });

  return (
    <BlockShell sectionId={sectionId} sectionType="form.consultation-booking" styleOverrides={styleOverrides} className="bg-slate-50">
      <div className="mx-auto max-w-marketing">
        {content.headline && (
          <h2 className="font-display text-h2 font-semibold text-slate-900" {...AB("booking-headline")}>
            {content.headline}
          </h2>
        )}
        {content.subhead && <p className="mt-3 text-body text-slate-700">{content.subhead}</p>}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-slate-200 bg-card p-4">
            <Calendar mode="single" selected={date} onSelect={setDate} />
          </div>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-card p-6">
            <div className="flex items-center gap-2 text-body-sm text-slate-600">
              <Clock className="h-4 w-4" />
              {content.meeting_length_minutes}-minute meeting
            </div>
            <h3 className="text-h5 font-semibold text-slate-900">
              {date ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Pick a day"}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Available time slots">
              {slotsForDay.length === 0 && (
                <p className="col-span-full flex items-center gap-2 text-body-sm text-slate-500">
                  <CalendarIcon className="h-4 w-4" /> No slots available for that day.
                </p>
              )}
              {slotsForDay.map((iso) => {
                const t = new Date(iso);
                const label = t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                const selected = slot === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSlot(iso)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-body-sm font-medium",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected ? "border-signal-500 bg-signal-500 text-white" : "border-slate-300 bg-card text-slate-700 hover:border-signal-300",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!slot}
              onClick={() => slot && onConfirm?.(form, slot)}
              {...AB("booking-cta")}
            >
              Confirm time
            </Button>
          </div>
        </div>
      </div>
    </BlockShell>
  );
}
