/**
 * ID generation — ULID with entity prefixes, per `docs/03 §0 Conventions`.
 *
 * All primary keys are TEXT and look like `<prefix>_<26 char ULID>`.
 * Total length = prefix (2-5 chars) + underscore + 26 = 29–32 chars.
 *
 * Prefixes are stable and MUST NOT change once shipped — they appear in URLs,
 * audit logs, and customer-visible IDs.
 */
import { ulid } from "ulid";

export const ID_PREFIXES = {
  user: "usr",
  workspace: "wsp",
  workspaceMember: "wsm",
  funnel: "fnl",
  funnelVersion: "fvr",
  crmContact: "crm",
  lead: "lds",
  booking: "bkg",
  subscription: "sub",
  invoice: "inv",
  payment: "pay",
  refund: "rfd",
  apiKey: "apk",
  webhook: "whk",
  auditLog: "aud",
  eventLog: "evt",
  asset: "ast",
  assetVersion: "asv",
  integration: "itg",
  revtryCall: "cll",
  adCampaign: "adc",
  emailSequence: "esq",
  smsSequence: "ssq",
  leadMagnet: "lmg",
  generation: "gen",
  agent: "agt",
  consent: "cns",
  suppression: "sup",
  deletionRequest: "dlq",
  ticket: "tkt",
  kbPack: "kbp",
  session: "ses",
  request: "req",
  qr: "qr",
  shortLink: "shl",
  customDomain: "dom",
  brand: "brd",
  template: "tmpl",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

/**
 * Generate a new ULID-prefixed ID, e.g. `newId("workspace")` → "wsp_01HXABC…".
 * Pass a literal prefix string if generating an entity not in the table.
 */
export function newId(
  entityOrPrefix: keyof typeof ID_PREFIXES | (string & {}),
  now: number = Date.now()
): string {
  const prefix =
    entityOrPrefix in ID_PREFIXES
      ? ID_PREFIXES[entityOrPrefix as keyof typeof ID_PREFIXES]
      : (entityOrPrefix as string);
  return `${prefix}_${ulid(now)}`;
}

/**
 * Strip the prefix off an id, returning the ULID portion. Useful when comparing
 * across systems that store the bare ULID.
 */
export function stripPrefix(id: string): string {
  const idx = id.indexOf("_");
  return idx === -1 ? id : id.slice(idx + 1);
}
