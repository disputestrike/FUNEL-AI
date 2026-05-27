"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar â€” react-day-picker themed for GoFunnelAI brand tokens.
 */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps): JSX.Element {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-body-sm font-semibold",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "tertiary", size: "icon" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-slate-500 rounded-md w-9 font-normal text-caption",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-body-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-signal-100",
          "[&:has([aria-selected].day-outside)]:bg-signal-100/50",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
        ),
        day: cn(
          buttonVariants({ variant: "tertiary", size: "icon" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-signal-500 text-white hover:bg-signal-600 hover:text-white focus:bg-signal-600 focus:text-white",
        day_today: "bg-slate-100 text-slate-900",
        day_outside: "day-outside text-slate-400 aria-selected:bg-signal-100/50 aria-selected:text-slate-400",
        day_disabled: "text-slate-400 opacity-50",
        day_range_middle: "aria-selected:bg-signal-100 aria-selected:text-slate-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
