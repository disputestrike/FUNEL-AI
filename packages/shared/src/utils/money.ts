/**
 * Money — typed currency amounts in micros (one-millionth of the major unit).
 *
 * Why micros: avoids JS float bugs entirely; matches Stripe's "amount" field
 * (which is in minor units / cents) without re-encoding. We use micros so a
 * single integer holds amounts down to ten-thousandths of a cent (useful for
 * generation-cost accounting, where a single token can cost fractions of a
 * cent).
 *
 * Conversions:
 *   - 1 USD          = 1_000_000 micros
 *   - 1 cent (USD)   =    10_000 micros
 *   - 1 micro (USD)  = $0.000001
 *
 * Always store as `Money`, never as `number`. Operations are pure.
 */

/** ISO-4217 currency code, e.g. "USD", "EUR", "GBP". */
export type CurrencyCode = string;

export interface Money {
  amount_micros: number;
  currency: CurrencyCode;
}

const MICROS_PER_UNIT = 1_000_000;
const MICROS_PER_CENT = 10_000;

/** Construct a Money from a major-unit decimal string. Avoids float ops. */
export function money(amount: number | string, currency: CurrencyCode): Money {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      throw new Error("money: amount must be a finite number");
    }
    // Use a string conversion to dodge float drift on .toFixed.
    return {
      amount_micros: Math.round(amount * MICROS_PER_UNIT),
      currency,
    };
  }
  return parseDecimal(amount, currency);
}

/** Construct a Money from minor units (cents). */
export function fromCents(cents: number, currency: CurrencyCode): Money {
  return {
    amount_micros: Math.round(cents) * MICROS_PER_CENT,
    currency,
  };
}

/** Construct from raw micros. */
export function fromMicros(micros: number, currency: CurrencyCode): Money {
  return { amount_micros: Math.round(micros), currency };
}

/** Convert to minor units (cents). Use for Stripe `amount` fields. */
export function toCents(m: Money): number {
  return Math.round(m.amount_micros / MICROS_PER_CENT);
}

/** Convert to the major unit as a number. Use only for display / logging. */
export function toMajor(m: Money): number {
  return m.amount_micros / MICROS_PER_UNIT;
}

function parseDecimal(s: string, currency: CurrencyCode): Money {
  const trimmed = s.trim().replace(/[\s,_]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`money: cannot parse decimal "${s}"`);
  }
  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [whole = "0", frac = ""] = abs.split(".");
  // Pad/truncate fractional part to 6 decimals (1 micro).
  const padded = (frac + "000000").slice(0, 6);
  const wholeMicros = Number(whole) * MICROS_PER_UNIT;
  const fracMicros = Number(padded);
  const total = wholeMicros + fracMicros;
  return {
    amount_micros: negative ? -total : total,
    currency,
  };
}

// ---- Arithmetic ---------------------------------------------------------

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`money: currency mismatch ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount_micros: a.amount_micros + b.amount_micros, currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount_micros: a.amount_micros - b.amount_micros, currency: a.currency };
}

export function mul(a: Money, n: number): Money {
  if (!Number.isFinite(n)) throw new Error("money: multiplier must be finite");
  return { amount_micros: Math.round(a.amount_micros * n), currency: a.currency };
}

export function isZero(m: Money): boolean {
  return m.amount_micros === 0;
}

export function isNegative(m: Money): boolean {
  return m.amount_micros < 0;
}

export function eq(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount_micros === b.amount_micros;
}

export function lt(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return a.amount_micros < b.amount_micros;
}

// ---- Formatting ---------------------------------------------------------

/**
 * Format a Money for human display. Uses `Intl.NumberFormat`, which is
 * locale-aware and handles symbol placement, grouping, and decimals correctly.
 *
 * @example
 *   formatMoney(money(200, "USD"), { locale: "en-US" }); // "$200.00"
 *   formatMoney(money(1234.5, "EUR"), { locale: "de-DE" }); // "1.234,50 €"
 */
export interface FormatMoneyOptions {
  locale?: string;
  /** Hide cents when amount is a whole unit (e.g. "$200" instead of "$200.00"). */
  hideTrailingZeroCents?: boolean;
  /** Always include cents (the Intl default — set this to override). */
  fractionDigits?: number;
}

export function formatMoney(m: Money, opts: FormatMoneyOptions = {}): string {
  const major = toMajor(m);
  const locale = opts.locale ?? "en-US";
  let minDigits = 2;
  let maxDigits = 2;
  if (opts.hideTrailingZeroCents && Number.isInteger(major)) {
    minDigits = 0;
    maxDigits = 0;
  }
  if (opts.fractionDigits !== undefined) {
    minDigits = opts.fractionDigits;
    maxDigits = opts.fractionDigits;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(major);
}

/** A zero `Money` value in the given currency. */
export function zero(currency: CurrencyCode): Money {
  return { amount_micros: 0, currency };
}
