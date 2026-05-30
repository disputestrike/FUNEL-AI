import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  DEFAULT_ENTERPRISE_ONBOARDING,
  PRODUCT_READINESS_AREAS,
  buildEnterpriseReadinessReport,
  campaignStageSummaries,
  type EnterpriseOnboardingInput,
} from '@/lib/product-readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EnterpriseOnboardingRequest = z.object({
  companyName: z.string().trim().min(1).max(120).default(DEFAULT_ENTERPRISE_ONBOARDING.companyName),
  industry: z.string().trim().min(1).max(120).default(DEFAULT_ENTERPRISE_ONBOARDING.industry),
  teamSize: z
    .enum(['solo', 'small_team', 'growth_team', 'enterprise'])
    .default(DEFAULT_ENTERPRISE_ONBOARDING.teamSize),
  crm: z
    .enum(['none', 'hubspot', 'salesforce', 'pipedrive', 'highlevel', 'custom'])
    .default(DEFAULT_ENTERPRISE_ONBOARDING.crm),
  launchWindow: z
    .enum(['this_week', 'this_month', 'this_quarter'])
    .default(DEFAULT_ENTERPRISE_ONBOARDING.launchWindow),
  channels: z
    .array(z.enum(['paid_search', 'paid_social', 'email', 'sms', 'voice', 'web']))
    .min(1)
    .default(DEFAULT_ENTERPRISE_ONBOARDING.channels),
  hasBrandAssets: z.boolean().default(DEFAULT_ENTERPRISE_ONBOARDING.hasBrandAssets),
  hasComplianceReview: z.boolean().default(DEFAULT_ENTERPRISE_ONBOARDING.hasComplianceReview),
  hasTestPlan: z.boolean().default(DEFAULT_ENTERPRISE_ONBOARDING.hasTestPlan),
  needsDataResidency: z.boolean().default(DEFAULT_ENTERPRISE_ONBOARDING.needsDataResidency),
});

export async function GET() {
  return NextResponse.json({
    ok: true,
    default_input: DEFAULT_ENTERPRISE_ONBOARDING,
    readiness_areas: PRODUCT_READINESS_AREAS,
    campaign_stages: campaignStageSummaries(),
  });
}

export async function POST(req: Request) {
  const parsed = EnterpriseOnboardingRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid enterprise onboarding payload.',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    buildEnterpriseReadinessReport(parsed.data as EnterpriseOnboardingInput),
  );
}
