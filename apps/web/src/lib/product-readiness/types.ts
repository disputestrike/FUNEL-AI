export type ProductReadinessAreaId =
  | 'ai_orchestration_readiness'
  | 'design_quality_engine'
  | 'asset_generation_storage'
  | 'crm_readiness'
  | 'testing_depth'
  | 'product_completeness';

export type ProductReadinessStatus = 'ready' | 'needs_input' | 'blocked';

export type EnterpriseTeamSize = 'solo' | 'small_team' | 'growth_team' | 'enterprise';
export type EnterpriseCrm =
  | 'none'
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'highlevel'
  | 'custom';
export type EnterpriseLaunchWindow = 'this_week' | 'this_month' | 'this_quarter';
export type EnterpriseChannel = 'paid_search' | 'paid_social' | 'email' | 'sms' | 'voice' | 'web';

export type ReadinessRegistryItem = {
  id: string;
  title: string;
  prompt: string;
  evaluation: string;
  evidence: string[];
  localCheck: string;
};

export type ProductReadinessArea = {
  ordinal: 4 | 6 | 7 | 9 | 13 | 15;
  id: ProductReadinessAreaId;
  title: string;
  capability: string;
  summary: string;
  registryTitle: string;
  releaseGate: string;
  automationHooks: string[];
  weight: number;
  registry: ReadinessRegistryItem[];
};

export type CampaignAutomationStage = {
  id: string;
  title: string;
  owner: string;
  areaIds: ProductReadinessAreaId[];
  trigger: string;
  deterministicOutput: string;
};

export type EnterpriseOnboardingInput = {
  companyName: string;
  industry: string;
  teamSize: EnterpriseTeamSize;
  crm: EnterpriseCrm;
  launchWindow: EnterpriseLaunchWindow;
  channels: EnterpriseChannel[];
  hasBrandAssets: boolean;
  hasComplianceReview: boolean;
  hasTestPlan: boolean;
  needsDataResidency: boolean;
};

export type AreaReadinessResult = {
  areaId: ProductReadinessAreaId;
  ordinal: ProductReadinessArea['ordinal'];
  title: string;
  capability: string;
  score: number;
  status: ProductReadinessStatus;
  evidence: string[];
  nextActions: string[];
  registry: ReadinessRegistryItem[];
};

export type EnterpriseReadinessReport = {
  ok: true;
  companyName: string;
  industry: string;
  overallScore: number;
  status: ProductReadinessStatus;
  priorityLanes: string[];
  areas: AreaReadinessResult[];
  assetStoragePlan: string[];
  crmPlan: string[];
  testingPlan: string[];
  completenessPlan: string[];
};
