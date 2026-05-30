import {
  CAMPAIGN_AUTOMATION_STAGES,
  DEFAULT_ENTERPRISE_ONBOARDING,
  PRODUCT_READINESS_AREAS,
} from './registry';
import type {
  AreaReadinessResult,
  EnterpriseChannel,
  EnterpriseCrm,
  EnterpriseOnboardingInput,
  EnterpriseReadinessReport,
  ProductReadinessArea,
  ProductReadinessAreaId,
  ProductReadinessStatus,
} from './types';

const CHANNEL_LABELS: Record<EnterpriseChannel, string> = {
  paid_search: 'paid search',
  paid_social: 'paid social',
  email: 'email',
  sms: 'SMS',
  voice: 'voice',
  web: 'web',
};

const CRM_LABELS: Record<EnterpriseCrm, string> = {
  none: 'No CRM selected',
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  pipedrive: 'Pipedrive',
  highlevel: 'HighLevel',
  custom: 'Custom CRM',
};

export function buildEnterpriseReadinessReport(
  input: EnterpriseOnboardingInput = DEFAULT_ENTERPRISE_ONBOARDING,
): EnterpriseReadinessReport {
  const normalized = normalizeEnterpriseInput(input);
  const areas = PRODUCT_READINESS_AREAS.map((area) => evaluateArea(area, normalized));
  const weightedTotal = areas.reduce((sum, area) => {
    const definition = PRODUCT_READINESS_AREAS.find((item) => item.id === area.areaId);
    return sum + area.score * (definition?.weight ?? 1);
  }, 0);
  const weightTotal = PRODUCT_READINESS_AREAS.reduce((sum, area) => sum + area.weight, 0);
  const overallScore = Math.round(weightedTotal / Math.max(weightTotal, 1));

  return {
    ok: true,
    companyName: normalized.companyName,
    industry: normalized.industry,
    overallScore,
    status: deriveOverallStatus(overallScore, areas),
    priorityLanes: buildPriorityLanes(areas),
    areas,
    assetStoragePlan: buildAssetStoragePlan(normalized),
    crmPlan: buildCrmPlan(normalized),
    testingPlan: buildTestingPlan(normalized),
    completenessPlan: buildCompletenessPlan(normalized, areas),
  };
}

export function normalizeEnterpriseInput(
  input: EnterpriseOnboardingInput,
): EnterpriseOnboardingInput {
  return {
    companyName: normalizeText(input.companyName, 'Enterprise preview'),
    industry: normalizeText(input.industry, 'General services'),
    teamSize: input.teamSize,
    crm: input.crm,
    launchWindow: input.launchWindow,
    channels: uniqueChannels(input.channels.length > 0 ? input.channels : ['web']),
    hasBrandAssets: Boolean(input.hasBrandAssets),
    hasComplianceReview: Boolean(input.hasComplianceReview),
    hasTestPlan: Boolean(input.hasTestPlan),
    needsDataResidency: Boolean(input.needsDataResidency),
  };
}

export function campaignStageSummaries() {
  return CAMPAIGN_AUTOMATION_STAGES.map((stage) => ({
    ...stage,
    gates: stage.areaIds.map((id) => {
      const area = PRODUCT_READINESS_AREAS.find((item) => item.id === id);
      return area?.title ?? id;
    }),
  }));
}

function evaluateArea(
  area: ProductReadinessArea,
  input: EnterpriseOnboardingInput,
): AreaReadinessResult {
  const score = scoreArea(area.id, input);

  return {
    areaId: area.id,
    ordinal: area.ordinal,
    title: area.title,
    capability: area.capability,
    score,
    status: statusFromScore(score),
    evidence: buildEvidence(area.id, input),
    nextActions: buildNextActions(area.id, input),
    registry: area.registry,
  };
}

function scoreArea(areaId: ProductReadinessAreaId, input: EnterpriseOnboardingInput) {
  const hasChannels = input.channels.length > 0;
  const hasCrm = input.crm !== 'none';
  const hasComplexFollowup = input.channels.includes('sms') || input.channels.includes('voice');
  const enterpriseScope = input.teamSize === 'enterprise' || input.needsDataResidency;

  const score = (() => {
    switch (areaId) {
    case 'ai_orchestration_readiness':
      return clampScore(
        48 +
          (input.industry ? 16 : 0) +
          (hasChannels ? 18 : 0) +
          (hasCrm ? 8 : 0) +
          (input.hasComplianceReview ? 10 : 0),
      );
    case 'design_quality_engine':
      return clampScore(
        45 +
          (input.hasBrandAssets ? 30 : 0) +
          (hasChannels ? 10 : 0) +
          (input.launchWindow !== 'this_week' ? 10 : 0),
      );
    case 'asset_generation_storage':
      return clampScore(
        42 +
          (input.hasBrandAssets ? 18 : 0) +
          (input.hasComplianceReview ? 14 : 0) +
          (input.needsDataResidency ? 8 : 14) +
          Math.min(input.channels.length * 4, 12),
      );
    case 'crm_readiness':
      return clampScore(
        35 +
          (hasCrm ? 32 : 0) +
          (hasChannels ? 12 : 0) +
          (!hasComplexFollowup || input.hasComplianceReview ? 16 : 0),
      );
    case 'testing_depth':
      return clampScore(
        38 +
          (input.hasTestPlan ? 30 : 0) +
          (input.hasComplianceReview ? 12 : 0) +
          (enterpriseScope ? 8 : 14),
      );
    case 'product_completeness':
      return clampScore(
        40 +
          (hasCrm ? 12 : 0) +
          (input.hasBrandAssets ? 12 : 0) +
          (input.hasTestPlan ? 14 : 0) +
          (input.hasComplianceReview ? 12 : 0) +
          (hasChannels ? 8 : 0),
      );
    }
  })();

  return applyCriticalLaunchCaps(areaId, input, score);
}

function applyCriticalLaunchCaps(
  areaId: ProductReadinessAreaId,
  input: EnterpriseOnboardingInput,
  score: number,
) {
  const hasCrm = input.crm !== 'none';
  const hasComplexFollowup = input.channels.includes('sms') || input.channels.includes('voice');
  let cappedScore = score;

  if (!input.hasComplianceReview) {
    if (areaId === 'ai_orchestration_readiness') cappedScore = Math.min(cappedScore, 74);
    if (areaId === 'asset_generation_storage') cappedScore = Math.min(cappedScore, 74);
    if (areaId === 'testing_depth') cappedScore = Math.min(cappedScore, 74);
    if (areaId === 'product_completeness') cappedScore = Math.min(cappedScore, 74);
    if (areaId === 'crm_readiness' && hasComplexFollowup) cappedScore = Math.min(cappedScore, 54);
  }

  if (!input.hasTestPlan && (areaId === 'testing_depth' || areaId === 'product_completeness')) {
    cappedScore = Math.min(cappedScore, 54);
  }

  if (!hasCrm && (areaId === 'crm_readiness' || areaId === 'product_completeness')) {
    cappedScore = Math.min(cappedScore, 54);
  }

  if (!input.hasBrandAssets && (areaId === 'design_quality_engine' || areaId === 'asset_generation_storage')) {
    cappedScore = Math.min(cappedScore, 74);
  }

  return cappedScore;
}

function buildEvidence(areaId: ProductReadinessAreaId, input: EnterpriseOnboardingInput) {
  const channelList = input.channels.map((channel) => CHANNEL_LABELS[channel]).join(', ');
  const crmLabel = CRM_LABELS[input.crm];

  switch (areaId) {
    case 'ai_orchestration_readiness':
      return [
        `${input.industry} brief normalized for ${channelList}`,
        `${input.launchWindow.replace(/_/g, ' ')} launch pressure captured`,
        input.hasComplianceReview
          ? 'Compliance review available for AI guardrails'
          : 'Compliance review missing from AI guardrails',
      ];
    case 'design_quality_engine':
      return [
        input.hasBrandAssets
          ? 'Brand inputs are ready for quality checks'
          : 'Brand inputs need collection before visual QA',
        `${input.channels.length} campaign channel set for responsive checks`,
        'CTA hierarchy and generated state checks registered',
      ];
    case 'asset_generation_storage':
      return [
        `${input.channels.length} channel-specific asset slot groups`,
        input.needsDataResidency
          ? 'Storage plan must preserve data residency'
          : 'Standard workspace storage plan available',
        input.hasComplianceReview
          ? 'Approval-state review is in scope'
          : 'Approval-state review needs an owner',
      ];
    case 'crm_readiness':
      return [
        `${crmLabel} handoff target`,
        input.channels.includes('sms') || input.channels.includes('voice')
          ? 'Consent checks required for SMS or voice follow-up'
          : 'Digital follow-up consent path is straightforward',
        `${input.teamSize.replace(/_/g, ' ')} owner-routing scope`,
      ];
    case 'testing_depth':
      return [
        input.hasTestPlan ? 'Local test plan exists' : 'Local test plan not confirmed',
        input.hasBrandAssets
          ? 'Visual fixtures can use supplied brand assets'
          : 'Visual fixtures need fallback assets',
        `${input.launchWindow.replace(/_/g, ' ')} release window drives fallback coverage`,
      ];
    case 'product_completeness':
      return [
        'Readiness verdict combines AI, design, assets, CRM, and testing',
        `${input.companyName} has ${input.channels.length} active launch channel groups`,
        input.hasTestPlan && input.hasBrandAssets
          ? 'Core launch inputs are present'
          : 'Core launch inputs are partially present',
      ];
  }
}

function buildNextActions(areaId: ProductReadinessAreaId, input: EnterpriseOnboardingInput) {
  const actions: string[] = [];

  if (areaId === 'ai_orchestration_readiness') {
    if (!input.hasComplianceReview)
      actions.push('Assign compliance owner for generated claims and follow-up language.');
    actions.push('Approve prompt output contracts for brief, offer, creative QA, and CRM summary.');
  }

  if (areaId === 'design_quality_engine') {
    if (!input.hasBrandAssets)
      actions.push('Collect logo, palette, typography, and approved proof assets.');
    actions.push('Run the quality registry against landing, dashboard, empty, and blocked states.');
  }

  if (areaId === 'asset_generation_storage') {
    actions.push('Create deterministic asset keys for hero, proof, ad, and lead magnet slots.');
    if (input.needsDataResidency)
      actions.push('Confirm the storage region before generated assets are persisted.');
  }

  if (areaId === 'crm_readiness') {
    if (input.crm === 'none') actions.push('Select the CRM target before launch.');
    actions.push('Map contact, deal, consent, source, score, and owner fields.');
  }

  if (areaId === 'testing_depth') {
    if (!input.hasTestPlan)
      actions.push(
        'Add unit, contract, visual, route, and fallback tests to the release checklist.',
      );
    actions.push('Create CRM payload fixtures for valid and invalid lead submissions.');
  }

  if (areaId === 'product_completeness') {
    actions.push('Review blocked states for every missing integration or approval.');
    actions.push('Confirm the end-to-end launch checklist has an owner for each lane.');
  }

  return actions;
}

function buildAssetStoragePlan(input: EnterpriseOnboardingInput) {
  const workspace = slugify(input.companyName);
  const base = input.needsDataResidency ? 'regional-workspace-assets' : 'workspace-assets';
  const channelSegments = input.channels.map(
    (channel) => `${base}/${workspace}/${CHANNEL_LABELS[channel].replace(/ /g, '-')}/v1`,
  );

  return [
    `Use ${base} as the storage namespace for generated files.`,
    `Reserve ${workspace}/lead-magnets/v1 for PDF and document exports.`,
    `Reserve ${workspace}/creative/v1 for hero, proof, and ad variants.`,
    ...channelSegments.map((segment) => `Create channel manifest at ${segment}/manifest.json.`),
  ];
}

function buildCrmPlan(input: EnterpriseOnboardingInput) {
  const crmLabel = CRM_LABELS[input.crm];
  const consentChannels = input.channels.filter(
    (channel) => channel === 'email' || channel === 'sms' || channel === 'voice',
  );

  return [
    `Target CRM: ${crmLabel}.`,
    'Map lead fields to contact, source campaign, score, offer, consent, and next action.',
    `Owner routing scope: ${input.teamSize.replace(/_/g, ' ')}.`,
    consentChannels.length > 0
      ? `Consent must be captured for ${consentChannels.map((channel) => CHANNEL_LABELS[channel]).join(', ')}.`
      : 'Consent capture can stay web-only for this launch slice.',
  ];
}

function buildTestingPlan(input: EnterpriseOnboardingInput) {
  return [
    'Unit coverage: score calculations, registry lookups, and blocked-state generation.',
    'Contract coverage: onboarding API schema, area results, asset manifest, and CRM payload fixtures.',
    input.hasBrandAssets
      ? 'Visual coverage: supplied brand assets across desktop and mobile campaign surfaces.'
      : 'Visual coverage: fallback asset states across desktop and mobile campaign surfaces.',
    input.launchWindow === 'this_week'
      ? 'Release coverage: smoke test the short-window path before adding new integrations.'
      : 'Release coverage: include fallback and rollback scenarios before launch approval.',
  ];
}

function buildCompletenessPlan(input: EnterpriseOnboardingInput, areas: AreaReadinessResult[]) {
  const blocked = areas.filter((area) => area.status === 'blocked');
  const needsInput = areas.filter((area) => area.status === 'needs_input');
  const firstBlocked = blocked[0];

  return [
    firstBlocked
      ? `Resolve blocked lane first: ${firstBlocked.title}.`
      : 'No blocked product-completeness lanes.',
    `${needsInput.length} lanes need input before the launch verdict moves to ready.`,
    `Launch owner should review ${input.companyName} across ${input.channels.length} channel groups.`,
    'Keep orchestration, design, assets, CRM, and test evidence visible in the release checklist.',
  ];
}

function buildPriorityLanes(areas: AreaReadinessResult[]) {
  return areas
    .filter((area) => area.status !== 'ready')
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((area) => area.title);
}

function statusFromScore(score: number): ProductReadinessStatus {
  if (score >= 80) return 'ready';
  if (score >= 55) return 'needs_input';
  return 'blocked';
}

function deriveOverallStatus(
  overallScore: number,
  areas: AreaReadinessResult[],
): ProductReadinessStatus {
  if (areas.some((area) => area.status === 'blocked')) return 'blocked';
  if (areas.some((area) => area.status === 'needs_input')) return 'needs_input';
  return statusFromScore(overallScore);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeText(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function uniqueChannels(channels: EnterpriseChannel[]) {
  return Array.from(new Set(channels));
}

function slugify(value: string) {
  return normalizeText(value, 'enterprise-preview')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
