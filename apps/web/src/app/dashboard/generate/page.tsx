/**
 * Live generation page (full-screen experience).
 *
 * Reads the generation brief from query params with safe defaults, then
 * hands off to the client component which opens the SSE stream to
 * /api/generate and renders the split-pane experience.
 *
 * URL shape:
 *   /dashboard/generate
 *     ?industry=Solar
 *     &offer=Give+a+savings+plan+first
 *     &audience=Homeowners
 *     &geography=US
 *     &businessName=Sunburst+Solar
 */

import { GenerateStreamingExperience } from "./GenerateStreamingExperience";

export const metadata = {
  title: "Generating your funnel | GoFunnelAI",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    industry?: string;
    offer?: string;
    audience?: string;
    geography?: string;
    businessName?: string;
    workspace_id?: string;
  };
}

export default function GeneratePage({ searchParams }: PageProps) {
  const initialInput = {
    workspace_id: searchParams.workspace_id ?? "web-preview",
    industry: searchParams.industry ?? "Local services",
    business_profile: {
      offer:
        searchParams.offer ??
        "Give a savings plan first, then book qualified consultations",
      target_customer:
        searchParams.audience ?? "Homeowners ready to lower their bills",
      geography: (searchParams.geography ?? "US").slice(0, 2).toUpperCase(),
      businessName: searchParams.businessName,
    },
  };

  return <GenerateStreamingExperience initialInput={initialInput} />;
}
