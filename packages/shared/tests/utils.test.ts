import { describe, it, expect } from "vitest";

import {
  prefixedId,
  isPrefixedId,
  idPrefix,
  idUlid,
  shortId,
  slugify,
  slugifyWithSuffix,
  isValidSlug,
  ensureUniqueSlug,
  money,
  fromCents,
  toCents,
  add,
  sub,
  mul,
  zero,
  formatMoney,
  hashEmail,
  hashPhone,
  redactPII,
  redactObject,
  normalizeEmail,
  normalizePhoneE164,
  nowIso,
  addMs,
  diffMs,
  fromIso,
  formatDuration,
  isValidTimezone,
} from "../src/utils/index.js";

describe("id utils", () => {
  it("generates prefixed IDs of the right shape", () => {
    const id = prefixedId("workspace");
    expect(id.startsWith("wsp_")).toBe(true);
    expect(id.length).toBe("wsp_".length + 26);
    expect(isPrefixedId(id, "workspace")).toBe(true);
    expect(isPrefixedId(id, "user")).toBe(false);
  });

  it("idPrefix and idUlid round-trip", () => {
    const id = prefixedId("funnel");
    expect(idPrefix(id)).toBe("fnl");
    const u = idUlid(id);
    expect(u).toBeTruthy();
    expect(u!.length).toBe(26);
  });

  it("monotonic ULIDs sort in order", () => {
    const a = prefixedId("event");
    const b = prefixedId("event");
    expect(a < b).toBe(true);
  });

  it("shortId yields a 12-char string", () => {
    const s = shortId();
    expect(s).toMatch(/^[a-z2-9]{12}$/);
  });
});

describe("slug utils", () => {
  it("slugifies arbitrary text", () => {
    expect(slugify("Texas Solar — Summer 2026!")).toBe("texas-solar-summer-2026");
    expect(slugify("  spaces  &  things  ")).toBe("spaces-and-things");
    expect(slugify("café au lait")).toBe("cafe-au-lait");
  });

  it("respects maxLength", () => {
    const long = "a".repeat(120);
    expect(slugify(long, { maxLength: 10 }).length).toBe(10);
  });

  it("slugifyWithSuffix appends a short suffix", () => {
    const s = slugifyWithSuffix("Texas Solar", { suffixLength: 6 });
    expect(s).toMatch(/^texas-solar-[a-z2-9]{6}$/);
  });

  it("isValidSlug catches obvious violators", () => {
    expect(isValidSlug("texas-solar")).toBe(true);
    expect(isValidSlug("Texas-Solar")).toBe(false);
    expect(isValidSlug("texas--solar")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });

  it("ensureUniqueSlug appends -2, -3 as needed", () => {
    const taken = new Set(["solar", "solar-2"]);
    expect(ensureUniqueSlug("Solar", taken)).toBe("solar-3");
  });
});

describe("money utils", () => {
  it("constructs from major-unit number", () => {
    const m = money(200, "USD");
    expect(m.amount_micros).toBe(200_000_000);
    expect(m.currency).toBe("USD");
  });

  it("constructs from cents", () => {
    const m = fromCents(20_000, "USD");
    expect(toCents(m)).toBe(20_000);
  });

  it("avoids float bugs on tricky decimals", () => {
    const m = money("0.1", "USD");
    const sum = add(add(m, m), m);
    expect(toCents(sum)).toBe(30); // exact 0.30
  });

  it("rejects currency mismatch", () => {
    const a = money(1, "USD");
    const b = money(1, "EUR");
    expect(() => add(a, b)).toThrow(/currency mismatch/);
  });

  it("sub and mul are pure", () => {
    expect(sub(money(5, "USD"), money(2, "USD")).amount_micros).toBe(3_000_000);
    expect(mul(money(2, "USD"), 3).amount_micros).toBe(6_000_000);
  });

  it("zero is currency-typed", () => {
    expect(zero("EUR").currency).toBe("EUR");
    expect(zero("EUR").amount_micros).toBe(0);
  });

  it("formatMoney respects hideTrailingZeroCents", () => {
    expect(formatMoney(money(200, "USD"), { hideTrailingZeroCents: true })).toBe("$200");
    expect(formatMoney(money(200.5, "USD"))).toBe("$200.50");
  });
});

describe("pii utils", () => {
  it("hashes emails after normalization", () => {
    const a = hashEmail("Foo@Bar.COM");
    const b = hashEmail("foo@bar.com");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes phones after E.164 normalization", () => {
    const a = hashPhone("(555) 867-5309");
    const b = hashPhone("+15558675309");
    expect(a).toBe(b);
  });

  it("normalizeEmail lowercases and trims", () => {
    expect(normalizeEmail(" Foo@BAR.com ")).toBe("foo@bar.com");
  });

  it("normalizePhoneE164 prepends + when missing", () => {
    expect(normalizePhoneE164("5558675309")).toBe("+15558675309");
    expect(normalizePhoneE164("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("redactPII strips obvious tokens", () => {
    const s = redactPII("Email me at john@example.com or call 555-867-5309 SSN 123-45-6789 from 192.168.1.1");
    expect(s).not.toContain("john@example.com");
    expect(s).not.toContain("555-867-5309");
    expect(s).not.toContain("123-45-6789");
    expect(s).not.toContain("192.168.1.1");
    expect(s).toContain("[email]");
    expect(s).toContain("[phone]");
    expect(s).toContain("[ssn]");
    expect(s).toContain("[ip]");
  });

  it("redactObject masks PII-named keys", () => {
    const out = redactObject({
      email: "x@y.com",
      phone: "+1555",
      api_key: "secret",
      meta: { count: 1, summary: "Call me at 555-867-5309" },
    });
    expect((out as Record<string, unknown>).email).toBe("[redacted]");
    expect((out as Record<string, unknown>).api_key).toBe("[redacted]");
    const meta = (out as { meta: { count: number; summary: string } }).meta;
    expect(meta.count).toBe(1);
    expect(meta.summary).not.toContain("555-867-5309");
  });
});

describe("time utils", () => {
  it("nowIso is parseable", () => {
    const s = nowIso();
    const d = fromIso(s);
    expect(d.toISOString()).toBe(s);
  });

  it("addMs and diffMs are inverse", () => {
    const a = nowIso();
    const b = addMs(a, 5_000);
    expect(diffMs(b, a)).toBe(5_000);
  });

  it("formatDuration handles ranges", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(4_200)).toBe("4.2s");
    expect(formatDuration(72_000)).toBe("1m 12s");
    expect(formatDuration(7_200_000)).toMatch(/^2h /);
  });

  it("isValidTimezone passes IANA names", () => {
    expect(isValidTimezone("America/Chicago")).toBe(true);
    expect(isValidTimezone("Nowhere/Bogus")).toBe(false);
  });
});
