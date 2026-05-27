/**
 * A/B variant assignment.
 *
 * Mechanism:
 *   variant = bucket(hash(visitor_id + funnel_id + experiment_id), weights)
 *
 * Stickiness:
 *   1. Cookie `fn_ab_<experiment_id>` is the primary store — fast, no extra
 *      round-trip per render.
 *   2. KV `ab:<visitor_id>:<funnel_id>` is the secondary fallback for visitors
 *      who blocked cookies.
 *   3. Same hash function used by the orchestrator's Bayesian engine so
 *      bucketing here can be cross-checked against the experiment store.
 *
 * The renderer treats each Section that carries a `variants[]` array as its
 * own implicit experiment. The Section's `id` IS the experiment_id.
 *
 * On first-render-with-experiment we emit an `ab_variant_assigned` event so
 * the Bayesian engine can join exposures → conversions.
 */

import type { Context } from "hono";
import type { HonoEnv } from "./env.js";
import { fnv1aHash32 } from "./lib/crypto.js";
import {
  buildSetCookie,
  COOKIE_AB_PREFIX,
  parseCookies,
} from "./lib/cookies.js";

/** A Section that carries `variants[]` plus its base content. */
export interface VariantSpec {
  id: string;
  weight: number;
  content?: unknown;
}

export interface AssignedVariant {
  experiment_id: string;
  variant_id: string;
  variant_index: number;
  is_base: boolean;
  content: unknown;
}

export interface AssignmentResult {
  assignments: Record<string, AssignedVariant>;
  newly_assigned: AssignedVariant[];
  composite_key: string;
}

/**
 * Pick a variant deterministically from weights. Returns the index that the
 * weighted hash lands on. If weights don't sum to 1.0 we normalize. If a
 * variant is missing we return -1 to signal "base content."
 */
export function bucket(weights: number[], hashU32: number): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return -1;
  const r = (hashU32 / 0xffffffff) * sum;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (r < acc) return i;
  }
  return weights.length - 1;
}

/**
 * Walk a funnel's pages → sections looking for `variants[]`. For each, pick a
 * variant (with cookie stickiness) and return the full assignment table.
 *
 * The renderer uses the returned table to overlay variant `content` onto each
 * section before render.
 */
export function assignVariantsForFunnel(
  c: Context<HonoEnv>,
  funnelJson: { pages?: Array<{ sections?: Array<{ id: string; content: unknown; variants?: VariantSpec[] }> }> },
  visitorId: string,
  funnelId: string
): AssignmentResult {
  const cookies = parseCookies(c.req.header("cookie"));
  const assignments: Record<string, AssignedVariant> = {};
  const newlyAssigned: AssignedVariant[] = [];

  for (const page of funnelJson.pages ?? []) {
    for (const section of page.sections ?? []) {
      const variants = section.variants;
      if (!variants || variants.length === 0) continue;
      const experimentId = section.id;
      const cookieName = `${COOKIE_AB_PREFIX}${experimentId.slice(0, 12)}`;
      const cookieVal = cookies[cookieName];

      // The base content is implicitly variant 0; declared variants are 1..N.
      const baseWeight = Math.max(
        0,
        1 - variants.reduce((a, v) => a + (v.weight ?? 0), 0)
      );
      const weights = [baseWeight, ...variants.map((v) => v.weight)];

      // If cookie names a known variant, use it.
      const knownIds = ["_base", ...variants.map((v) => v.id)];
      let chosenIdx = -1;
      if (cookieVal && knownIds.includes(cookieVal)) {
        chosenIdx = knownIds.indexOf(cookieVal);
      } else {
        const h = fnv1aHash32(`${visitorId}|${funnelId}|${experimentId}`);
        chosenIdx = bucket(weights, h);
        if (chosenIdx < 0) chosenIdx = 0;
      }

      const isBase = chosenIdx === 0;
      const variantId = isBase ? "_base" : variants[chosenIdx - 1]!.id;
      const content = isBase ? section.content : variants[chosenIdx - 1]!.content;
      const a: AssignedVariant = {
        experiment_id: experimentId,
        variant_id: variantId,
        variant_index: chosenIdx,
        is_base: isBase,
        content,
      };
      assignments[experimentId] = a;

      if (cookieVal !== variantId) {
        newlyAssigned.push(a);
        // Set sticky cookie on the response.
        c.res.headers.append(
          "set-cookie",
          buildSetCookie(cookieName, variantId, {
            maxAgeSeconds: 60 * 60 * 24 * 30,
            sameSite: "Lax",
          })
        );
      }
    }
  }

  // Composite key used by edge-cache so cache variants by assignment.
  const composite = Object.entries(assignments)
    .map(([k, v]) => `${k.slice(0, 8)}=${v.variant_id.slice(0, 8)}`)
    .sort()
    .join(",");

  return { assignments, newly_assigned: newlyAssigned, composite_key: composite || "_base" };
}

/**
 * Apply assignment to the funnel JSON in-place (shallow clone of sections).
 * Returns a new funnel object — we never mutate the cached one.
 */
export function applyAssignments(
  funnelJson: { pages?: Array<{ sections?: Array<{ id: string; content: unknown; variants?: VariantSpec[] }> }> },
  assignments: Record<string, AssignedVariant>
): typeof funnelJson {
  if (Object.keys(assignments).length === 0) return funnelJson;
  return {
    ...funnelJson,
    pages: (funnelJson.pages ?? []).map((page) => ({
      ...page,
      sections: (page.sections ?? []).map((s) => {
        const a = assignments[s.id];
        if (!a || a.is_base) return s;
        return { ...s, content: a.content };
      }),
    })),
  };
}

/**
 * Emit `ab_variant_assigned` for every newly-assigned exposure. Side-effected
 * outside the request path via `ctx.waitUntil()`.
 *
 * Schema (matches doc 03 governance § exposures):
 *   { experiment_id, variant_id, visitor_id, funnel_id, funnel_version_id,
 *     workspace_id, exposed_at, ip_hash, geo_country }
 */
export interface AbExposureRecord {
  experiment_id: string;
  variant_id: string;
  visitor_id: string;
  funnel_id: string;
  funnel_version_id: string;
  workspace_id: string;
  exposed_at: string;
  ip_hash: string;
  geo_country?: string;
}

export async function emitExposures(
  apiBaseUrl: string,
  internalSecret: string,
  records: AbExposureRecord[]
): Promise<void> {
  if (records.length === 0) return;
  try {
    await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/internal/ab/exposures`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({ records }),
    });
  } catch {
    // We intentionally swallow — losing an exposure beat must not break a
    // page render. Bayesian engine reconciles drift in its 5-minute window.
  }
}
