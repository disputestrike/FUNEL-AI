import * as React from "react";
import { cn } from "../../lib/cn";
import { BlockCTA, BlockShell } from "../primitives";
import type { BlockBaseProps, CTAId } from "../types";
import { AB } from "../types";

/**
 * hero.urgency — Countdown + headline + CTA.
 * Doc 18 B.1.6. Compliance Agent flags fake countdowns.
 */
export interface HeroUrgencyContent {
  headline: string;
  subhead?: string;
  countdown: {
    target_iso8601: string;
    show_days: boolean;
    label_text?: string;
    behavior_on_expiry: "hide_block" | "show_expired_message" | "evergreen_reset_per_visitor";
  };
  primary_cta_id: CTAId;
}

export type HeroUrgencyVariant = "centered" | "banner-style";

export interface HeroUrgencyProps extends BlockBaseProps {
  content: HeroUrgencyContent;
  variant?: HeroUrgencyVariant;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function timeLeft(targetIso: string): TimeLeft {
  const target = new Date(targetIso).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

function CountdownTimer({ targetIso, showDays }: { targetIso: string; showDays: boolean }): JSX.Element {
  const [now, setNow] = React.useState(() => timeLeft(targetIso));
  // Announce remaining time at minute granularity, not per second — doc 18.
  const lastMinuteRef = React.useRef(now.minutes);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(timeLeft(targetIso)), 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  React.useEffect(() => {
    if (now.minutes !== lastMinuteRef.current) {
      lastMinuteRef.current = now.minutes;
    }
  }, [now.minutes]);

  if (now.expired) {
    return (
      <p className="text-body font-semibold" aria-live="polite">
        Time’s up.
      </p>
    );
  }
  const parts = showDays
    ? [
        { label: "days", value: now.days },
        { label: "hours", value: now.hours },
        { label: "minutes", value: now.minutes },
        { label: "seconds", value: now.seconds },
      ]
    : [
        { label: "hours", value: now.hours + now.days * 24 },
        { label: "minutes", value: now.minutes },
        { label: "seconds", value: now.seconds },
      ];
  return (
    <div className="flex justify-center gap-4 tnum" aria-live="polite" aria-atomic="false">
      <span className="sr-only">
        {now.days} days, {now.hours} hours, {now.minutes} minutes remaining
      </span>
      {parts.map((p) => (
        <div key={p.label} className="text-center">
          <div className="font-display text-h2 font-semibold leading-none md:text-h1">{String(p.value).padStart(2, "0")}</div>
          <div className="text-caption uppercase tracking-wider opacity-80">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

export function HeroUrgency({ content, variant = "centered", sectionId, resolveCTA, styleOverrides }: HeroUrgencyProps): JSX.Element | null {
  const primary = resolveCTA?.(content.primary_cta_id);
  const expired = new Date(content.countdown.target_iso8601).getTime() <= Date.now();
  if (expired && content.countdown.behavior_on_expiry === "hide_block") return null;

  return (
    <BlockShell
      sectionId={sectionId}
      sectionType="hero.urgency"
      styleOverrides={{ ...styleOverrides, padding_y: styleOverrides?.padding_y ?? (variant === "banner-style" ? "sm" : "md") }}
      className={cn("text-white bg-gradient-to-r from-signal-600 to-signal-500")}
    >
      <div className="mx-auto max-w-4xl text-center">
        {content.countdown.label_text && (
          <p className="text-caption font-medium uppercase tracking-wider opacity-90">{content.countdown.label_text}</p>
        )}
        <div className="mt-4">
          <CountdownTimer targetIso={content.countdown.target_iso8601} showDays={content.countdown.show_days} />
        </div>
        <h2 className="mt-6 font-display text-h2 font-semibold md:text-h1" {...AB("hero-headline")}>
          {content.headline}
        </h2>
        {content.subhead && <p className="mt-4 text-body-lg opacity-90">{content.subhead}</p>}
        <div className="mt-8 flex justify-center">
          <BlockCTA cta={primary} variantOverride="secondary" {...AB("hero-primary-cta")} />
        </div>
      </div>
    </BlockShell>
  );
}
