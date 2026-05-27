/**
 * Auto-generated social share copy + image manifest.
 *
 * Triggered the moment a milestone fires. Returned payload is what the
 * in-app celebration modal needs to prefill share-to-twitter / LinkedIn / IG.
 */

import { OG_IMAGE_DIMS } from "./constants.js";
import type { Award, AwardWinner, CaseStudyPage } from "./types.js";

export interface ShareKit {
  og_image: { url: string; width: number; height: number; alt: string };
  badge: { svg_url: string; png_1080: string; png_linkedin: string; png_x: string };
  copy: {
    twitter: string;
    linkedin: string;
    instagram: string;
    facebook: string;
  };
  links: {
    case_study_url: string;
    build_yours_url: string;
  };
}

const TIER_LABEL: Record<Award["tier"], string> = {
  bronze: "Bronze ($10K)",
  silver: "Silver ($100K)",
  gold: "Gold ($1M)",
  platinum: "Platinum ($10M)",
  diamond: "Diamond ($100M)",
};

export function buildShareKit(args: {
  award: Award;
  winner: AwardWinner;
  caseStudy: CaseStudyPage;
  baseUrl?: string;
}): ShareKit {
  const base = args.baseUrl ?? "https://gofunnelai.com";
  const url = `${base}/wins/${args.caseStudy.slug}`;
  const buildYours = `${base}/build-yours?utm_source=case_study&utm_medium=share&utm_campaign=${args.award.tier}&case=${args.caseStudy.slug}`;
  const tier = TIER_LABEL[args.award.tier];
  const name = args.winner.display_name ?? "An anonymous builder";
  const usd = `$${Math.round(args.award.revenue_at_milestone_cents / 100).toLocaleString()}`;

  return {
    og_image: {
      url: args.caseStudy.og_image_url ?? `${base}/og/wins/${args.caseStudy.slug}.png`,
      width: OG_IMAGE_DIMS.width,
      height: OG_IMAGE_DIMS.height,
      alt: `${name} earned the GoFunnelAI ${tier} award — ${usd} through one funnel.`,
    },
    badge: {
      svg_url: `${base}/badges/${args.award.tier}.svg`,
      png_1080: `${base}/badges/${args.award.tier}_1080.png`,
      png_linkedin: `${base}/badges/${args.award.tier}_linkedin.png`,
      png_x: `${base}/badges/${args.award.tier}_x.png`,
    },
    copy: {
      twitter: `I just crossed ${usd} with one funnel — and GoFunnelAI gave me the ${tier} award. ${url}`,
      linkedin: `Just hit a milestone: ${usd} generated through a single GoFunnelAI funnel. The ${tier} award arrived in my inbox this morning.\n\nFull story → ${url}`,
      instagram: `New milestone unlocked: ${tier}. ${usd} through one funnel, built with GoFunnelAI. Story → bio.`,
      facebook: `Big day — ${usd} earned through one funnel. GoFunnelAI sent me the ${tier} award. Story: ${url}`,
    },
    links: {
      case_study_url: url,
      build_yours_url: buildYours,
    },
  };
}
