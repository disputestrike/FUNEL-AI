/**
 * Industry catalog (30 industries for Day 90 launch).
 *
 * Each industry is keyed by a stable slug, sits in a higher-level cluster,
 * routes to a default `VoicePersona`, and carries a `regulated_flag` that
 * triggers the compliance fact-check gate.
 */

import type { VoicePersona } from "./persona.js";
import type { RegulatedVertical } from "./compliance.js";

export enum IndustryCluster {
  HomeServices = "home_services",
  Health = "health",
  Coaching = "coaching",
  Professional = "professional",
  Financial = "financial",
  RealEstate = "real_estate",
  Ecommerce = "ecommerce",
  Education = "education",
  Wellness = "wellness",
  Other = "other",
}

export interface IndustryMeta {
  slug: string;
  name: string;
  cluster: IndustryCluster;
  default_persona: VoicePersona;
  regulated_flag: boolean;
  /** Maps onto a `RegulatedVertical` enum value if `regulated_flag` is true. */
  regulated_vertical?: RegulatedVertical;
  /** Common one-line description used by onboarding pickers. */
  blurb: string;
}
