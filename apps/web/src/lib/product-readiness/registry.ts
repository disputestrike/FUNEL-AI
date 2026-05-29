import type {
  CampaignAutomationStage,
  EnterpriseOnboardingInput,
  ProductReadinessArea,
} from './types';

export const DEFAULT_ENTERPRISE_ONBOARDING: EnterpriseOnboardingInput = {
  companyName: 'Enterprise preview',
  industry: 'Home services',
  teamSize: 'growth_team',
  crm: 'hubspot',
  launchWindow: 'this_month',
  channels: ['web', 'email', 'paid_search'],
  hasBrandAssets: true,
  hasComplianceReview: false,
  hasTestPlan: true,
  needsDataResidency: false,
};

export const PRODUCT_READINESS_AREAS: ProductReadinessArea[] = [
  {
    ordinal: 4,
    id: 'ai_orchestration_readiness',
    title: 'AI Orchestration Readiness',
    capability: 'Prompts and evals registry',
    summary:
      'Defines the prompt contracts, handoff rules, and local evals required before campaign automation can run.',
    registryTitle: 'Prompt and eval registry',
    releaseGate:
      'Every AI handoff has a named prompt, an expected output shape, and an eval before launch.',
    automationHooks: [
      'Lead intake brief',
      'Offer strategy synthesis',
      'Creative QA pass',
      'CRM handoff summary',
    ],
    weight: 18,
    registry: [
      {
        id: 'ai.prompt.intake-router',
        title: 'Intake router prompt',
        prompt:
          'Classify the enterprise brief into industry, audience, offer, channel, and launch-risk lanes.',
        evaluation:
          'Passes when all lanes are present, no field is invented, and unknowns are returned as explicit questions.',
        evidence: ['industry', 'channels', 'launchWindow'],
        localCheck: 'Requires at least one channel and a named industry.',
      },
      {
        id: 'ai.prompt.offer-synthesizer',
        title: 'Offer synthesizer prompt',
        prompt:
          'Convert the brief into a lead magnet, primary CTA, proof requirements, and follow-up promise.',
        evaluation:
          'Passes when the output includes one free value asset, one conversion CTA, and one measurable proof slot.',
        evidence: ['industry', 'hasComplianceReview'],
        localCheck: 'Flags compliance review as required for regulated teams.',
      },
      {
        id: 'ai.eval.handoff-contract',
        title: 'Agent handoff eval',
        prompt:
          'Evaluate whether each generated artifact can be consumed by the next local workflow without hidden context.',
        evaluation:
          'Passes when artifacts have ids, owners, inputs, outputs, and fallback copy for missing integrations.',
        evidence: ['teamSize', 'crm'],
        localCheck:
          'Enterprise teams must have a CRM target before handoff readiness is marked ready.',
      },
    ],
  },
  {
    ordinal: 6,
    id: 'design_quality_engine',
    title: 'Design Quality Engine',
    capability: 'Design quality registry',
    summary:
      'Locks the quality rules used to grade generated pages, assets, and campaign surfaces before publication.',
    registryTitle: 'Quality engine registry',
    releaseGate:
      'Generated campaign UI meets brand, hierarchy, contrast, state, and responsive gates.',
    automationHooks: [
      'Brand token match',
      'Layout density check',
      'CTA hierarchy check',
      'Responsive state check',
    ],
    weight: 16,
    registry: [
      {
        id: 'design.eval.brand-system',
        title: 'Brand system fit',
        prompt:
          'Compare generated campaign surfaces against approved palette, type scale, spacing, and button hierarchy.',
        evaluation:
          'Passes when primary actions, secondary actions, captions, and proof blocks match local design tokens.',
        evidence: ['hasBrandAssets'],
        localCheck:
          'Brand assets increase readiness; missing assets create a pre-launch input lane.',
      },
      {
        id: 'design.eval.responsive-density',
        title: 'Responsive density',
        prompt:
          'Score whether campaign dashboards and landing pages remain scannable across compact and wide layouts.',
        evaluation:
          'Passes when controls do not wrap awkwardly, cards retain stable dimensions, and labels stay readable.',
        evidence: ['channels'],
        localCheck: 'Multiple channels require additional density checks for automation surfaces.',
      },
      {
        id: 'design.eval.conversion-clarity',
        title: 'Conversion clarity',
        prompt:
          'Audit each campaign step for one dominant action, proof proximity, and a clear fallback state.',
        evaluation:
          'Passes when the generated flow has one next action per step and no orphaned conversion blocks.',
        evidence: ['launchWindow'],
        localCheck: 'Short launch windows require clarity to be ready before asset expansion.',
      },
    ],
  },
  {
    ordinal: 7,
    id: 'asset_generation_storage',
    title: 'Asset Generation And Storage Plan',
    capability: 'Asset generation and storage plan',
    summary:
      'Defines how generated images, PDFs, copy exports, and previews are named, stored, and reused locally.',
    registryTitle: 'Asset plan registry',
    releaseGate:
      'Every generated asset has a slot, deterministic file key, approval state, and storage destination.',
    automationHooks: [
      'Image prompt slots',
      'PDF lead magnet export',
      'Creative variant manifest',
      'Storage path contract',
    ],
    weight: 15,
    registry: [
      {
        id: 'asset.plan.slot-manifest',
        title: 'Slot manifest',
        prompt:
          'Create asset slots for hero media, proof visuals, ad variants, and downloadable lead magnets.',
        evaluation:
          'Passes when each slot has a role, dimensions, fallback, alt text, and owning campaign stage.',
        evidence: ['channels', 'hasBrandAssets'],
        localCheck: 'Channel count determines the minimum asset slot count.',
      },
      {
        id: 'asset.plan.storage-key',
        title: 'Storage key contract',
        prompt:
          'Assign deterministic keys under workspace, campaign, asset role, locale, and version segments.',
        evaluation:
          'Passes when keys are stable across retries and do not depend on external provider response ids.',
        evidence: ['needsDataResidency'],
        localCheck: 'Data residency changes the storage destination requirement.',
      },
      {
        id: 'asset.eval.approval-state',
        title: 'Approval state eval',
        prompt:
          'Check that generated assets are labeled draft, approved, rejected, or replaced before launch.',
        evaluation:
          'Passes when no draft asset is referenced by a live campaign unless an approved fallback exists.',
        evidence: ['hasComplianceReview'],
        localCheck: 'Compliance review is required before regulated assets can be launch-ready.',
      },
    ],
  },
  {
    ordinal: 9,
    id: 'crm_readiness',
    title: 'CRM Readiness',
    capability: 'CRM mapping and handoff readiness',
    summary:
      'Maps lead fields, lifecycle stages, consent, ownership, and handoff notes for local CRM integration planning.',
    registryTitle: 'CRM readiness registry',
    releaseGate:
      'Lead capture can write a normalized contact, source, consent, score, and next action.',
    automationHooks: [
      'Lead field mapping',
      'Lifecycle stage assignment',
      'Owner routing',
      'Follow-up task creation',
    ],
    weight: 17,
    registry: [
      {
        id: 'crm.plan.field-map',
        title: 'Lead field map',
        prompt:
          'Map generated form fields into contact, company, deal, consent, source, and campaign objects.',
        evaluation:
          'Passes when required fields have CRM destinations and optional fields have safe null behavior.',
        evidence: ['crm'],
        localCheck: 'A CRM other than none is required for ready status.',
      },
      {
        id: 'crm.plan.lifecycle',
        title: 'Lifecycle stage map',
        prompt:
          'Translate campaign events into lead, MQL, SQL, booked, won, lost, and nurture lifecycle states.',
        evaluation:
          'Passes when every automation event has a CRM stage and no stage skips owner review.',
        evidence: ['teamSize', 'channels'],
        localCheck: 'Growth and enterprise teams require owner routing.',
      },
      {
        id: 'crm.eval.consent-source',
        title: 'Consent and source eval',
        prompt:
          'Validate that every lead handoff contains source campaign, consent language, and follow-up permission.',
        evaluation:
          'Passes when consent is explicit for email, SMS, and voice channels before follow-up automation.',
        evidence: ['channels', 'hasComplianceReview'],
        localCheck: 'SMS and voice channels require compliance review to be ready.',
      },
    ],
  },
  {
    ordinal: 13,
    id: 'testing_depth',
    title: 'Testing Depth',
    capability: 'Testing matrix and launch confidence',
    summary:
      'Sets the minimum deterministic test coverage for orchestration, page quality, assets, CRM handoff, and release gates.',
    registryTitle: 'Testing depth registry',
    releaseGate:
      'Launch has unit, contract, visual, route, and fallback coverage for the selected campaign scope.',
    automationHooks: [
      'Prompt contract tests',
      'API route schema tests',
      'Visual regression pass',
      'CRM payload fixture',
    ],
    weight: 17,
    registry: [
      {
        id: 'test.matrix.contract',
        title: 'Contract test matrix',
        prompt:
          'List deterministic contract tests for prompt outputs, API schemas, asset manifests, and CRM payloads.',
        evaluation:
          'Passes when every external-facing shape has a local fixture and at least one invalid-input case.',
        evidence: ['hasTestPlan'],
        localCheck: 'A named test plan is required for ready status.',
      },
      {
        id: 'test.matrix.visual',
        title: 'Visual quality matrix',
        prompt:
          'Define viewport, empty state, loading state, and generated-content visual checks for campaign surfaces.',
        evaluation:
          'Passes when campaign pages can be reviewed across desktop and mobile without external services.',
        evidence: ['hasBrandAssets'],
        localCheck: 'Brand assets and design registry combine to drive visual test priority.',
      },
      {
        id: 'test.matrix.rollback',
        title: 'Rollback and fallback matrix',
        prompt:
          'Specify launch-blocking failures, fallback content, disabled integrations, and recovery checks.',
        evaluation:
          'Passes when every blocked provider path has a local fallback and a clear user-facing state.',
        evidence: ['launchWindow', 'crm'],
        localCheck: 'Short launch windows require fallback coverage to avoid blocking release.',
      },
    ],
  },
  {
    ordinal: 15,
    id: 'product_completeness',
    title: 'Product Completeness',
    capability: 'Product completeness release gate',
    summary:
      'Combines orchestration, design, assets, CRM, and tests into a bounded launch-readiness verdict.',
    registryTitle: 'Completeness registry',
    releaseGate:
      'The product slice is usable end to end with clear blocked states and no invisible manual work.',
    automationHooks: [
      'End-to-end readiness summary',
      'Blocked state copy',
      'Launch checklist',
      'Owner handoff',
    ],
    weight: 17,
    registry: [
      {
        id: 'complete.eval.workflow',
        title: 'End-to-end workflow eval',
        prompt:
          'Check that enterprise intake, automation planning, asset planning, CRM mapping, and testing evidence connect.',
        evaluation:
          'Passes when a user can move from readiness intake to launch plan without missing ownership or next actions.',
        evidence: ['teamSize', 'channels', 'crm'],
        localCheck: 'Completeness inherits readiness from every prior area.',
      },
      {
        id: 'complete.eval-blocked-states',
        title: 'Blocked state eval',
        prompt:
          'Verify that unavailable integrations, missing assets, and incomplete tests produce explicit blocked states.',
        evaluation:
          'Passes when every gap includes a clear label, owner, and local remediation step.',
        evidence: ['hasBrandAssets', 'hasTestPlan', 'hasComplianceReview'],
        localCheck:
          'Missing inputs lower the completeness score but still produce deterministic output.',
      },
      {
        id: 'complete.plan.release',
        title: 'Release checklist plan',
        prompt:
          'Generate a release checklist covering prompt registry, design gate, asset storage, CRM handoff, and tests.',
        evaluation:
          'Passes when the checklist has no external dependency assumptions and can be reviewed locally.',
        evidence: ['launchWindow'],
        localCheck: 'Launch window selects the checklist urgency.',
      },
    ],
  },
];

export const CAMPAIGN_AUTOMATION_STAGES: CampaignAutomationStage[] = [
  {
    id: 'intake-to-brief',
    title: 'Intake to campaign brief',
    owner: 'Product',
    areaIds: ['ai_orchestration_readiness', 'product_completeness'],
    trigger: 'Enterprise onboarding submitted',
    deterministicOutput: 'Normalized brief with launch gaps and ranked readiness lanes',
  },
  {
    id: 'brief-to-creative-system',
    title: 'Brief to creative system',
    owner: 'Design',
    areaIds: ['design_quality_engine', 'asset_generation_storage'],
    trigger: 'Brief reaches partial or ready status',
    deterministicOutput: 'Design gate list, asset slot manifest, and storage key plan',
  },
  {
    id: 'lead-to-crm',
    title: 'Lead to CRM handoff',
    owner: 'Revenue operations',
    areaIds: ['crm_readiness', 'testing_depth'],
    trigger: 'Lead capture fields approved',
    deterministicOutput: 'CRM field map, consent notes, owner routing, and fixture coverage',
  },
  {
    id: 'launch-readiness',
    title: 'Launch readiness',
    owner: 'Engineering',
    areaIds: ['testing_depth', 'product_completeness'],
    trigger: 'All area scores exceed the local threshold',
    deterministicOutput: 'Launch verdict, blocked states, and release checklist',
  },
];
