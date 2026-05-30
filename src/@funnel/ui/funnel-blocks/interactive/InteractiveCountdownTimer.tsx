import * as React from "react";
import { BlockShell } from "../primitives";
import type { BlockBaseProps } from "../types";

export interface InteractiveCountdownTimerContent {
  headline?: string;
  subhead?: string;
  ends_at: string; // ISO timestamp
}

export interface InteractiveCountdownTimerProps extends BlockBaseProps {
  content: InteractiveCountdownTimerContent;
}

function diff(target: number): { d: number; h: number; m: number; s: number; expired: boolean } {
  const now = Date.now();
  let ms = target - now;
  if (ms < 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  const d = Math.floor(ms / 86_400_000); ms -= d * 86_400_000;
  const h = Math.floor(ms / 3_600_000); ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000); ms -= m * 60_000;
  const s = Math.floor(ms / 1000);
  return { d, h, m, s, expired: false };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function InteractiveCountdownTimer({ content, sectionId, styleOverrides }: InteractiveCountdownTimerProps): JSX.Element {
  const target = React.useMemo(() => new Date(content.ends_at).getTime(), [content.ends_at]);
  const [tick, setTick] = React.useState(() => diff(target));
  React.useEffect(() => {
    const id = setInterval(() => setTick(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <BlockShell sectionId={sectionId} sectionType="interactive.countdown-timer" styleOverrides={styleOverrides}>
      <div className="mx-auto max-w-2xl text-center">
        {content.headline && <h2 className="font-display text-h2 font-semibold text-slate-900">{content.headline}</h2>}
        {content.subhead && <p className="mt-2 text-body-lg text-slate-600">{content.subhead}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {[
            { label: "Days", value: tick.d },
            { label: "Hours", value: tick.h },
            { label: "Minutes", value: tick.m },
            { label: "Seconds", value: tick.s },
          ].map((unit) => (
            <div key={unit.label} className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
              <div className="text-display-2 font-black tabular-nums text-signal-700">{pad(unit.value)}</div>
              <div className="mt-1 text-caption font-semibold uppercase tracking-wider text-slate-500">{unit.label}</div>
            </div>
          ))}
        </div>
        {tick.expired && <p className="mt-4 text-body-sm font-semibold text-ember-700">Offer has ended</p>}
      </div>
    </BlockShell>
  );
}
