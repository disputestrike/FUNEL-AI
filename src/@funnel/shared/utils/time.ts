/**
 * Time helpers.
 *
 * GoFunnelAI stores all timestamps in UTC ISO-8601 with microsecond
 * precision. This module centralizes that convention so callers don't
 * accidentally format with local time.
 */

/** Returns a new ISO-8601 UTC string for `now`. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Returns the ISO-8601 UTC string for a Date. */
export function toIso(d: Date): string {
  return d.toISOString();
}

/** Parse an ISO-8601 string into a Date. Throws on invalid input. */
export function fromIso(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`time: cannot parse ISO-8601 "${s}"`);
  }
  return d;
}

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Add `ms` milliseconds to an ISO-8601 timestamp; returns a new ISO-8601. */
export function addMs(iso: string, ms: number): string {
  return new Date(fromIso(iso).getTime() + ms).toISOString();
}

/** Return the number of milliseconds between two ISO-8601 timestamps. */
export function diffMs(later: string, earlier: string): number {
  return fromIso(later).getTime() - fromIso(earlier).getTime();
}

/**
 * Format a Date or ISO-8601 in a target IANA timezone.
 *
 * @example
 *   formatInTimezone(nowIso(), { timezone: "America/Chicago", locale: "en-US" });
 *   // "May 25, 2026, 12:42:01 PM CDT"
 */
export interface FormatInTimezoneOptions {
  timezone: string;
  locale?: string;
  /** Intl.DateTimeFormat style overrides. */
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
}

export function formatInTimezone(
  value: string | Date,
  opts: FormatInTimezoneOptions
): string {
  const d = typeof value === "string" ? fromIso(value) : value;
  return new Intl.DateTimeFormat(opts.locale ?? "en-US", {
    timeZone: opts.timezone,
    dateStyle: opts.dateStyle ?? "medium",
    timeStyle: opts.timeStyle ?? "short",
  }).format(d);
}

/**
 * Returns true if the IANA timezone string is recognized by the host's ICU.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate to the start of the day in a given timezone, returned as a UTC
 * ISO-8601.
 */
export function startOfDayInTz(value: string | Date, tz: string): string {
  const d = typeof value === "string" ? fromIso(value) : value;
  // Build a "midnight in tz" using Intl parts so DST is honored.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  // Construct a Date at "tz midnight" by formatting a wall-clock value back.
  // Use the approach: build a UTC date for that wall-clock, then offset.
  const wall = new Date(`${y}-${m}-${day}T00:00:00Z`);
  const offsetMs = wallClockOffsetMs(wall, tz);
  return new Date(wall.getTime() - offsetMs).toISOString();
}

function wallClockOffsetMs(utcMidnight: Date, tz: string): number {
  // Find the offset such that (utcMidnight - offset) renders as midnight in tz.
  const tzString = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(utcMidnight);
  const [hh, mm, ss] = tzString.split(":").map((n) => Number(n));
  return (((hh ?? 0) * 60 + (mm ?? 0)) * 60 + (ss ?? 0)) * 1000;
}

/** Pretty-print a duration in ms as e.g. "4.2s", "1m 12s", "2h 0m". */
export function formatDuration(ms: number): string {
  if (ms < SECOND_MS) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / SECOND_MS);
  if (totalSeconds < 60) return `${(ms / SECOND_MS).toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

/** Is a timestamp older than `ms` milliseconds? */
export function isStale(iso: string, ms: number): boolean {
  return Date.now() - fromIso(iso).getTime() > ms;
}
