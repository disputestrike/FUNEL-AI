"use client";

import * as React from "react";

import { clamp } from "@/lib/grader/utils";

interface ScoreDialProps {
  value: number; // 0-100
  grade?: string;
  size?: number;
  animate?: boolean;
}

/** Animated radial dial showing the overall 0-100 score with letter grade. */
export function ScoreDial({ value, grade, size = 220, animate = true }: ScoreDialProps) {
  const [displayed, setDisplayed] = React.useState(animate ? 0 : value);

  React.useEffect(() => {
    if (!animate) {
      setDisplayed(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    const from = displayed;
    const to = clamp(value, 0, 100);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animate]);

  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp(displayed, 0, 100) / 100);
  const color = displayed >= 80 ? "#16a34a" : displayed >= 60 ? "#f59e0b" : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef2f7" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-6xl font-bold tabular-nums text-ink-900">{displayed}</div>
        {grade && <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-ink-900/60">Grade {grade}</div>}
      </div>
    </div>
  );
}
