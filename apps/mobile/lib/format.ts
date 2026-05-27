/**
 * Display formatters — currency, durations, relative time.
 *
 * All copy must follow doc 22 brand voice. Currency uses tabular figures
 * (a font feature toggled in styles), short "$200" not "$200.00".
 */
import { formatDistanceToNowStrict } from "date-fns";

export function formatCurrencyUSD(cents: number, opts: { compact?: boolean } = {}): string {
  const dollars = cents / 100;
  if (opts.compact && dollars >= 1000) {
    const k = dollars / 1000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  const whole = Number.isInteger(dollars);
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRelativeTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function formatLeadScoreLabel(score: "hot" | "warm" | "cold"): string {
  switch (score) {
    case "hot":
      return "Hot";
    case "warm":
      return "Warm";
    case "cold":
      return "Cold";
  }
}

/** Used for the phone-call deep link. Strips formatting and keeps a leading +. */
export function normalizePhoneForTel(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  return trimmed.replace(/\D/g, "");
}
