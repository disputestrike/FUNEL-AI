/**
 * ID generation utilities.
 *
 * IDs are ULID strings, prefixed by entity kind, e.g. `wsp_01HX…`. Prefixes
 * are 3 lowercase chars followed by `_`. The full ID length is `prefix(3) + _(1) + ulid(26) = 30`.
 *
 * ULIDs are lexicographically sortable by time, URL-safe, and contain no
 * hot index keys — preferable to UUIDv4 for primary keys.
 */

import { customAlphabet } from "nanoid";
import { ulid as ulidFn, monotonicFactory } from "ulid";

/**
 * The canonical entity prefix map. Add a new prefix here when you add a new
 * entity. Keep them 3-letter and lowercase.
 */
export const ID_PREFIXES = {
  workspace: "wsp",
  workspace_member: "wsm",
  user: "usr",
  funnel: "fnl",
  funnel_version: "fvr",
  page: "pag",
  section: "sec",
  asset: "ast",
  form: "frm",
  cta: "cta",
  contact: "crm",
  lead: "lds",
  booking: "bkg",
  pipeline: "pip",
  pipeline_stage: "pst",
  subscription: "sub",
  invoice: "inv",
  payment: "pay",
  refund: "rfd",
  generation: "gen",
  agent_invocation: "agi",
  event: "evt",
  consent: "cns",
  session: "ses",
  request: "req",
  api_key: "apk",
  webhook: "whk",
  compliance_flag: "cfl",
  fact_check_report: "fcr",
  audit_log: "aud",
  campaign: "cmp",
  message: "msg",
  call: "cal",
  ticket: "tkt",
  notification: "ntf",
  credit: "crd",
  domain: "dom",
  short_link: "sln",
  qr: "qrc",
  consumer: "csm",
} as const;

export type IdPrefixKind = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdPrefixKind];

/**
 * Monotonic ULID factory ensures strict sortability even when called twice
 * in the same millisecond.
 */
const monotonicUlid = monotonicFactory();

/**
 * Generate a raw ULID (no prefix). Most callers want `prefixedId(kind)`.
 */
export function ulid(seedTime?: number): string {
  return seedTime === undefined ? monotonicUlid() : monotonicUlid(seedTime);
}

/**
 * Generate a prefixed ID for an entity kind.
 *
 * @example
 *   const id = prefixedId("workspace");   // "wsp_01HX..."
 *   const id = prefixedId("funnel");      // "fnl_01HX..."
 */
export function prefixedId(kind: IdPrefixKind, seedTime?: number): string {
  return `${ID_PREFIXES[kind]}_${ulid(seedTime)}`;
}

/**
 * Lower-cardinality random key for things that don't need ULID semantics
 * (e.g. share codes, short slugs).
 */
const SHORT_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // unambiguous Crockford-ish
const generateShortId = customAlphabet(SHORT_ALPHABET, 12);

/** Generate a 12-char URL-safe short id (e.g. for share codes). */
export function shortId(): string {
  return generateShortId();
}

/**
 * Returns true if `id` is a valid prefixed ID for the given `kind`.
 * Use this in API request validators.
 */
export function isPrefixedId(id: unknown, kind: IdPrefixKind): id is string {
  if (typeof id !== "string") return false;
  const prefix = ID_PREFIXES[kind];
  if (!id.startsWith(`${prefix}_`)) return false;
  if (id.length !== prefix.length + 1 + 26) return false;
  return ULID_REGEX.test(id.slice(prefix.length + 1));
}

/** Extract the prefix from an ID, or `null` if malformed. */
export function idPrefix(id: string): string | null {
  const i = id.indexOf("_");
  return i > 0 ? id.slice(0, i) : null;
}

/** Strip the prefix from an ID and return the raw ULID, or `null` if malformed. */
export function idUlid(id: string): string | null {
  const i = id.indexOf("_");
  if (i < 0) return null;
  const rest = id.slice(i + 1);
  return ULID_REGEX.test(rest) ? rest : null;
}

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Default ULID generator from the `ulid` package (re-exported for ergonomics). */
export const rawUlid = ulidFn;
