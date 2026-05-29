export type EnterpriseReadinessAreaId =
  | "enterprise_identity"
  | "signalwire_automation"
  | "observability_dashboard"
  | "admin_operations";

export type EnterpriseReadinessSourceItem = 2 | 10 | 12 | 14;

export type ReadinessState = "ready" | "needs_configuration" | "blocked";

export type ReadinessRisk = "low" | "medium" | "high";

export type EnvCheckMode = "all" | "any";

export type EnterpriseOwner =
  | "Security"
  | "Voice"
  | "SRE"
  | "Operations"
  | "Support"
  | "Billing";

export interface EnvCredentialCheck {
  id: string;
  label: string;
  mode: EnvCheckMode;
  required: boolean;
  purpose: string;
  keys: readonly string[];
  present: boolean;
  presentKeys: readonly string[];
  missingKeys: readonly string[];
}

export interface EnterpriseReadinessControl {
  id: string;
  label: string;
  state: ReadinessState;
  required: boolean;
  evidence: string;
}

export interface EnterpriseReadinessArea {
  id: EnterpriseReadinessAreaId;
  sourceItem: EnterpriseReadinessSourceItem;
  title: string;
  summary: string;
  owner: EnterpriseOwner;
  risk: ReadinessRisk;
  state: ReadinessState;
  score: number;
  credentialChecks: readonly EnvCredentialCheck[];
  controls: readonly EnterpriseReadinessControl[];
  blockers: readonly string[];
  nextActions: readonly string[];
  evidence: readonly string[];
}

export type ObservabilityUnit = "count" | "percent" | "milliseconds" | "minutes";

export interface ObservabilityMetric {
  id: string;
  label: string;
  value: number;
  unit: ObservabilityUnit;
  objective: string;
  state: ReadinessState;
  owner: EnterpriseOwner;
}

export interface ObservabilityPanel {
  id: string;
  title: string;
  metricIds: readonly string[];
  queryKey: string;
  owner: EnterpriseOwner;
}

export interface EnterpriseObservabilityDashboard {
  title: string;
  dataSource: "local-readiness-snapshot";
  refreshCadence: string;
  metrics: readonly ObservabilityMetric[];
  panels: readonly ObservabilityPanel[];
}

export type AdminRole =
  | "read_only"
  | "support"
  | "billing_admin"
  | "engineering"
  | "super_admin";

export interface AdminOperationCapability {
  id: string;
  label: string;
  allowedRoles: readonly AdminRole[];
  requiresTicket: boolean;
  auditEvent: string;
  notes: string;
}

export interface EnterpriseReadinessSnapshot {
  schemaVersion: "enterprise-readiness.v1";
  asOf: string;
  ok: boolean;
  environment: "local";
  overall: {
    state: ReadinessState;
    score: number;
    readyAreas: number;
    totalAreas: number;
    blockerCount: number;
  };
  areas: readonly EnterpriseReadinessArea[];
  observability: EnterpriseObservabilityDashboard;
  adminOperations: {
    roles: readonly AdminRole[];
    capabilities: readonly AdminOperationCapability[];
  };
}
