"use client";

import * as React from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "../lib/cn";

export type PreviewViewport = "desktop" | "mobile";

export interface MobilePreviewToggleProps {
  value: PreviewViewport;
  onChange: (next: PreviewViewport) => void;
  className?: string;
}

/**
 * Two-state segmented control to switch the preview between a desktop
 * (full-width) and mobile (phone-frame) viewport. Pair with
 * `FunnelPreviewRenderer mobileFrame={value === "mobile"}`.
 */
export function MobilePreviewToggle({ value, onChange, className }: MobilePreviewToggleProps): JSX.Element {
  return (
    <div className={cn("inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm", className)} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={value === "desktop"}
        onClick={() => onChange("desktop")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold transition",
          value === "desktop" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
        )}
      >
        <Monitor className="h-3.5 w-3.5" /> Desktop
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "mobile"}
        onClick={() => onChange("mobile")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold transition",
          value === "mobile" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
        )}
      >
        <Smartphone className="h-3.5 w-3.5" /> Mobile
      </button>
    </div>
  );
}
