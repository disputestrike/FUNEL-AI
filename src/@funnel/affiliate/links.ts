/**
 * Short-link service.
 *
 * `gofunnelai.com/r/<code>` — 302 redirect to the affiliate's destination URL
 * with UTM injection + cookie set. The redirect itself is served by the edge
 * worker; this module owns the data model + URL builder.
 */

import { LINK_CODE_CHARS, LINK_CODE_LEN } from "./constants.js";
import type { AffiliateStore } from "./store.js";
import type { Affiliate, AffiliateLink } from "./types.js";

export interface CreateLinkInput {
  affiliate_id: string;
  /** Where the redirect lands; defaults to gofunnelai.com/?ref=<code>. */
  destination_url?: string;
  /** Up to 100 sub-IDs per affiliate; freeform but ≤ 64 chars. */
  sub_id?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface LinkDeps {
  store: AffiliateStore;
  newId: (entity: "shortLink") => string;
  random?: () => number;
  baseUrl?: string;   // default "https://gofunnelai.com"
  clock?: { iso(): string };
}

const defaultClock = { iso: () => new Date().toISOString() };

export async function createLink(input: CreateLinkInput, deps: LinkDeps): Promise<AffiliateLink> {
  const rand = deps.random ?? Math.random;
  const base = deps.baseUrl ?? "https://gofunnelai.com";

  // Enforce 100-subid cap per affiliate.
  if (input.sub_id) {
    const existing = await deps.store.listLinksForAffiliate(input.affiliate_id);
    const distinct = new Set(existing.map((l) => l.sub_id).filter(Boolean));
    if (!distinct.has(input.sub_id) && distinct.size >= 100) {
      throw new Error("affiliate has reached 100 sub-IDs");
    }
  }

  const code = await generateUniqueLinkCode(deps.store, rand);
  const dest = input.destination_url ?? `${base}/?ref=${code}`;

  const link: AffiliateLink = {
    id: deps.newId("shortLink"),
    affiliate_id: input.affiliate_id,
    code,
    sub_id: input.sub_id ?? null,
    destination_url: dest,
    utm_source: "affiliate",
    utm_medium: "referral",
    utm_campaign: input.utm_campaign ?? null,
    utm_content: input.utm_content ?? null,
    created_at: (deps.clock ?? defaultClock).iso(),
  };
  return deps.store.insertLink(link);
}

async function generateUniqueLinkCode(
  store: AffiliateStore,
  rand: () => number,
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    let code = "";
    for (let j = 0; j < LINK_CODE_LEN; j++) {
      code += LINK_CODE_CHARS[Math.floor(rand() * LINK_CODE_CHARS.length)];
    }
    const exists = await store.getLinkByCode(code);
    if (!exists) return code;
  }
  throw new Error("could not generate unique link code");
}

/**
 * Build the actual public short URL. Edge worker resolves `/r/:code` →
 * 302 → `injectUtms(link.destination_url, link)`.
 */
export function buildPublicShortUrl(link: AffiliateLink, baseUrl = "https://gofunnelai.com"): string {
  return `${baseUrl}/r/${link.code}`;
}

/**
 * Inject UTMs onto a destination URL deterministically. We DO NOT clobber
 * existing UTM params on the destination — the customer's `destination_url`
 * may already carry a campaign config, so we only fill blanks.
 */
export function injectUtms(destinationUrl: string, link: AffiliateLink): string {
  const u = new URL(destinationUrl);
  const set = (k: string, v: string | null | undefined) => {
    if (!v) return;
    if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  };
  set("utm_source", link.utm_source);
  set("utm_medium", link.utm_medium);
  set("utm_campaign", link.utm_campaign);
  set("utm_content", link.utm_content);
  set("ref", link.code);
  if (link.sub_id) set("sub", link.sub_id);
  return u.toString();
}

/** Default referral landing URL for an affiliate's primary code (no sub-id). */
export function buildReferralUrl(a: Affiliate, baseUrl = "https://gofunnelai.com"): string {
  return `${baseUrl}/?ref=${a.referral_code}`;
}
