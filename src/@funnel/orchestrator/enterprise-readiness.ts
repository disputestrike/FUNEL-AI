export type EnterpriseReadinessAreaId = 1 | 3 | 5 | 11 | 12 | 16;
export type EnterpriseReadinessStatus = "ready" | "needs_attention" | "blocked";
export type EnterpriseReadinessSeverity = "required" | "recommended";
export type EnterpriseReadinessCheckState = "pass" | "warn" | "fail";

export interface EnterpriseReadinessCheck {
  id: string;
  label: string;
  state: EnterpriseReadinessCheckState;
  severity: EnterpriseReadinessSeverity;
  evidence: string;
}

export interface EnterpriseReadinessArea {
  id: EnterpriseReadinessAreaId;
  name: string;
  contract: string;
  status: EnterpriseReadinessStatus;
  summary: string;
  checks: EnterpriseReadinessCheck[];
}

export interface EnterpriseReadinessReport {
  schema_version: "myfunnela.enterprise-readiness.v1";
  status: EnterpriseReadinessStatus;
  score: number;
  areas: EnterpriseReadinessArea[];
  blockers: string[];
  warnings: string[];
}

export interface ProductionDatabaseReadinessContract {
  engine: "postgres" | "mysql" | "sqlite" | "other";
  connectionPooling: boolean;
  migrations: {
    strategy: "automated" | "manual" | "none";
    rollback: boolean;
    driftDetection: boolean;
  };
  backup: {
    pointInTimeRecovery: boolean;
    retentionDays: number;
    restoreRunbook: boolean;
    restoreTested: boolean;
  };
  tenancy: {
    isolation: "rls" | "workspace_id" | "schema" | "database" | "none";
    enforcedInQueries: boolean;
  };
  idempotency: {
    keys: boolean;
    transactionalOutbox: boolean;
    uniqueConstraints: boolean;
  };
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    secretsManaged: boolean;
  };
  audit: {
    mutationLog: boolean;
    actorTracking: boolean;
  };
}

export interface DurableWorkflowEngineContract {
  engine: "temporal" | "inngest" | "bullmq" | "cloud_tasks" | "custom" | "none";
  persistence: "database" | "queue" | "memory";
  retries: {
    maxAttempts: number;
    backoff: "exponential" | "fixed" | "none";
    deadLetterQueue: boolean;
  };
  execution: {
    resumable: boolean;
    idempotentSteps: boolean;
    stepTimeoutSeconds: number;
    heartbeat: boolean;
    cancellation: boolean;
  };
  effects: {
    transactionalOutbox: boolean;
    idempotencyKeys: boolean;
    exactlyOnceClaimsAvoided: boolean;
  };
  auditEvents: boolean;
}

export interface PublishingVersioningCustomDomainReadinessContract {
  versioning: {
    immutableVersions: boolean;
    draftPreview: boolean;
    rollback: boolean;
    contentHash: boolean;
  };
  publishing: {
    atomicPublish: boolean;
    statusTransitions: boolean;
    publishedAtTracking: boolean;
  };
  customDomains: {
    supported: boolean;
    ownershipVerification: boolean;
    automatedTls: boolean;
    dnsInstructions: boolean;
    canonicalRedirect: boolean;
  };
  assets: {
    durableStorage: boolean;
    cacheInvalidation: boolean;
  };
}

export interface SecurityComplianceReadinessContract {
  auth: {
    sso: boolean;
    mfa: boolean;
    sessionExpiry: boolean;
  };
  authorization: {
    rbac: boolean;
    tenantScopedRoles: boolean;
    serviceRoleIsolation: boolean;
  };
  dataProtection: {
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
    piiMinimization: boolean;
    retentionPolicy: boolean;
    exportDelete: boolean;
  };
  compliance: {
    auditLog: boolean;
    consentTracking: boolean;
    policyEvidence: boolean;
    vendorInventory: boolean;
  };
  secrets: {
    centralManager: boolean;
    rotationRunbook: boolean;
    noPlaintextEnvInLogs: boolean;
  };
}

export interface ObservabilityReadinessContract {
  logs: {
    structured: boolean;
    redaction: boolean;
    correlationIds: boolean;
  };
  metrics: {
    latency: boolean;
    errorRate: boolean;
    queueDepth: boolean;
    cost: boolean;
  };
  tracing: {
    workflowSpans: boolean;
    providerSpans: boolean;
  };
  alerts: {
    onCallRouting: boolean;
    sloThresholds: boolean;
  };
  health: {
    readinessEndpoint: boolean;
    livenessEndpoint: boolean;
    syntheticPublish: boolean;
  };
}

export interface DeploymentReadinessContract {
  environments: {
    separateProd: boolean;
    promotionPath: boolean;
    configValidation: boolean;
  };
  releases: {
    zeroDowntime: boolean;
    rollback: boolean;
    smokeTests: boolean;
    migrationGate: boolean;
  };
  operations: {
    runbook: boolean;
    scalingPlan: boolean;
    regionFailover: boolean;
    dependencyChecks: boolean;
  };
  safety: {
    featureFlags: boolean;
    canary: boolean;
    backupsBeforeMigrate: boolean;
  };
}

export interface EnterpriseReadinessInput {
  productionDatabase: ProductionDatabaseReadinessContract;
  durableWorkflowEngine: DurableWorkflowEngineContract;
  publishingVersioningCustomDomain: PublishingVersioningCustomDomainReadinessContract;
  securityCompliance: SecurityComplianceReadinessContract;
  observability: ObservabilityReadinessContract;
  deployment: DeploymentReadinessContract;
}

export function assessProductionDatabaseReadiness(
  contract: ProductionDatabaseReadinessContract,
): EnterpriseReadinessArea {
  return buildArea({
    id: 1,
    name: "Production Database Readiness",
    contract: "production_database",
    checks: [
      required(
        "database.engine.production",
        "Uses a production database engine",
        contract.engine === "postgres" || contract.engine === "mysql",
        `engine=${contract.engine}`,
      ),
      required(
        "database.connection_pooling",
        "Connection pooling is configured",
        contract.connectionPooling,
        boolEvidence(contract.connectionPooling),
      ),
      required(
        "database.migrations.automated",
        "Migrations have an automated strategy",
        contract.migrations.strategy === "automated",
        `strategy=${contract.migrations.strategy}`,
      ),
      required(
        "database.migrations.rollback",
        "Migration rollback path exists",
        contract.migrations.rollback,
        boolEvidence(contract.migrations.rollback),
      ),
      recommended(
        "database.migrations.drift_detection",
        "Schema drift detection is available",
        contract.migrations.driftDetection,
        boolEvidence(contract.migrations.driftDetection),
      ),
      required(
        "database.backup.pitr",
        "Point-in-time recovery is enabled",
        contract.backup.pointInTimeRecovery,
        boolEvidence(contract.backup.pointInTimeRecovery),
      ),
      required(
        "database.backup.retention",
        "Backups retain at least 7 days",
        contract.backup.retentionDays >= 7,
        `retentionDays=${contract.backup.retentionDays}`,
      ),
      required(
        "database.tenancy.isolation",
        "Tenant isolation is enforced",
        contract.tenancy.isolation !== "none" && contract.tenancy.enforcedInQueries,
        `isolation=${contract.tenancy.isolation}; enforcedInQueries=${contract.tenancy.enforcedInQueries}`,
      ),
      required(
        "database.idempotency.keys",
        "Idempotency keys and uniqueness are enforced",
        contract.idempotency.keys && contract.idempotency.uniqueConstraints,
        `keys=${contract.idempotency.keys}; uniqueConstraints=${contract.idempotency.uniqueConstraints}`,
      ),
      recommended(
        "database.idempotency.outbox",
        "Transactional outbox protects side effects",
        contract.idempotency.transactionalOutbox,
        boolEvidence(contract.idempotency.transactionalOutbox),
      ),
      required(
        "database.encryption",
        "Database traffic and storage are encrypted",
        contract.encryption.atRest && contract.encryption.inTransit && contract.encryption.secretsManaged,
        `atRest=${contract.encryption.atRest}; inTransit=${contract.encryption.inTransit}; secretsManaged=${contract.encryption.secretsManaged}`,
      ),
      required(
        "database.audit",
        "Mutation audit log records actor context",
        contract.audit.mutationLog && contract.audit.actorTracking,
        `mutationLog=${contract.audit.mutationLog}; actorTracking=${contract.audit.actorTracking}`,
      ),
      recommended(
        "database.restore_tested",
        "Restore process is documented and tested",
        contract.backup.restoreRunbook && contract.backup.restoreTested,
        `restoreRunbook=${contract.backup.restoreRunbook}; restoreTested=${contract.backup.restoreTested}`,
      ),
    ],
  });
}

export function assessDurableWorkflowEngineReadiness(
  contract: DurableWorkflowEngineContract,
): EnterpriseReadinessArea {
  return buildArea({
    id: 3,
    name: "Durable Workflow Engine",
    contract: "durable_workflow_engine",
    checks: [
      required(
        "workflow.engine.selected",
        "A durable workflow engine is selected",
        contract.engine !== "none",
        `engine=${contract.engine}`,
      ),
      required(
        "workflow.persistence.durable",
        "Workflow state is not memory-only",
        contract.persistence === "database" || contract.persistence === "queue",
        `persistence=${contract.persistence}`,
      ),
      required(
        "workflow.retries.backoff",
        "Retries use bounded attempts with backoff",
        contract.retries.maxAttempts >= 2 && contract.retries.backoff !== "none",
        `maxAttempts=${contract.retries.maxAttempts}; backoff=${contract.retries.backoff}`,
      ),
      required(
        "workflow.retries.dead_letter",
        "Dead-letter queue or failed-job lane exists",
        contract.retries.deadLetterQueue,
        boolEvidence(contract.retries.deadLetterQueue),
      ),
      required(
        "workflow.execution.resumable",
        "Executions can resume after process restarts",
        contract.execution.resumable,
        boolEvidence(contract.execution.resumable),
      ),
      required(
        "workflow.execution.idempotent_steps",
        "Workflow steps are idempotent",
        contract.execution.idempotentSteps,
        boolEvidence(contract.execution.idempotentSteps),
      ),
      required(
        "workflow.execution.timeouts",
        "Step timeouts are bounded",
        contract.execution.stepTimeoutSeconds > 0 && contract.execution.stepTimeoutSeconds <= 900,
        `stepTimeoutSeconds=${contract.execution.stepTimeoutSeconds}`,
      ),
      recommended(
        "workflow.execution.heartbeat",
        "Long-running work emits heartbeats",
        contract.execution.heartbeat,
        boolEvidence(contract.execution.heartbeat),
      ),
      recommended(
        "workflow.execution.cancellation",
        "Workflow cancellation is supported",
        contract.execution.cancellation,
        boolEvidence(contract.execution.cancellation),
      ),
      required(
        "workflow.effects.safe",
        "External side effects are protected by outbox or idempotency keys",
        contract.effects.transactionalOutbox || contract.effects.idempotencyKeys,
        `transactionalOutbox=${contract.effects.transactionalOutbox}; idempotencyKeys=${contract.effects.idempotencyKeys}`,
      ),
      recommended(
        "workflow.effects.exactly_once_language",
        "Contract avoids unsupported exactly-once guarantees",
        contract.effects.exactlyOnceClaimsAvoided,
        boolEvidence(contract.effects.exactlyOnceClaimsAvoided),
      ),
      required(
        "workflow.audit_events",
        "Workflow lifecycle emits audit events",
        contract.auditEvents,
        boolEvidence(contract.auditEvents),
      ),
    ],
  });
}

export function assessPublishingVersioningCustomDomainReadiness(
  contract: PublishingVersioningCustomDomainReadinessContract,
): EnterpriseReadinessArea {
  return buildArea({
    id: 5,
    name: "Publishing, Versioning, and Custom Domains",
    contract: "publishing_versioning_custom_domain",
    checks: [
      required(
        "publishing.versioning.immutable",
        "Published versions are immutable",
        contract.versioning.immutableVersions,
        boolEvidence(contract.versioning.immutableVersions),
      ),
      required(
        "publishing.versioning.preview",
        "Draft preview exists before publish",
        contract.versioning.draftPreview,
        boolEvidence(contract.versioning.draftPreview),
      ),
      required(
        "publishing.versioning.rollback",
        "Published funnels can roll back",
        contract.versioning.rollback,
        boolEvidence(contract.versioning.rollback),
      ),
      recommended(
        "publishing.versioning.content_hash",
        "Content hashes identify published assets",
        contract.versioning.contentHash,
        boolEvidence(contract.versioning.contentHash),
      ),
      required(
        "publishing.atomic",
        "Publish operation is atomic",
        contract.publishing.atomicPublish,
        boolEvidence(contract.publishing.atomicPublish),
      ),
      required(
        "publishing.status_transitions",
        "Publish lifecycle has explicit status transitions",
        contract.publishing.statusTransitions && contract.publishing.publishedAtTracking,
        `statusTransitions=${contract.publishing.statusTransitions}; publishedAtTracking=${contract.publishing.publishedAtTracking}`,
      ),
      required(
        "publishing.custom_domains.supported",
        "Custom domains are supported",
        contract.customDomains.supported,
        boolEvidence(contract.customDomains.supported),
      ),
      required(
        "publishing.custom_domains.ownership",
        "Custom domain ownership is verified",
        contract.customDomains.ownershipVerification,
        boolEvidence(contract.customDomains.ownershipVerification),
      ),
      required(
        "publishing.custom_domains.tls",
        "Custom domains receive automated TLS",
        contract.customDomains.automatedTls,
        boolEvidence(contract.customDomains.automatedTls),
      ),
      recommended(
        "publishing.custom_domains.dns",
        "DNS instructions and canonical redirects are handled",
        contract.customDomains.dnsInstructions && contract.customDomains.canonicalRedirect,
        `dnsInstructions=${contract.customDomains.dnsInstructions}; canonicalRedirect=${contract.customDomains.canonicalRedirect}`,
      ),
      required(
        "publishing.assets.durable",
        "Published assets use durable storage",
        contract.assets.durableStorage,
        boolEvidence(contract.assets.durableStorage),
      ),
      recommended(
        "publishing.assets.cache_invalidation",
        "Publish and rollback invalidate cached assets",
        contract.assets.cacheInvalidation,
        boolEvidence(contract.assets.cacheInvalidation),
      ),
    ],
  });
}

export function assessSecurityComplianceReadiness(
  contract: SecurityComplianceReadinessContract,
): EnterpriseReadinessArea {
  return buildArea({
    id: 11,
    name: "Security and Compliance",
    contract: "security_compliance",
    checks: [
      required(
        "security.auth.sso_mfa",
        "SSO, MFA, and session expiry are available",
        contract.auth.sso && contract.auth.mfa && contract.auth.sessionExpiry,
        `sso=${contract.auth.sso}; mfa=${contract.auth.mfa}; sessionExpiry=${contract.auth.sessionExpiry}`,
      ),
      required(
        "security.authorization.rbac",
        "RBAC is tenant-scoped",
        contract.authorization.rbac && contract.authorization.tenantScopedRoles,
        `rbac=${contract.authorization.rbac}; tenantScopedRoles=${contract.authorization.tenantScopedRoles}`,
      ),
      required(
        "security.authorization.service_roles",
        "Service roles are isolated from user roles",
        contract.authorization.serviceRoleIsolation,
        boolEvidence(contract.authorization.serviceRoleIsolation),
      ),
      required(
        "security.data.encryption",
        "Data is encrypted in transit and at rest",
        contract.dataProtection.encryptionAtRest && contract.dataProtection.encryptionInTransit,
        `atRest=${contract.dataProtection.encryptionAtRest}; inTransit=${contract.dataProtection.encryptionInTransit}`,
      ),
      recommended(
        "security.data.pii_minimization",
        "PII is minimized by contract",
        contract.dataProtection.piiMinimization,
        boolEvidence(contract.dataProtection.piiMinimization),
      ),
      required(
        "security.data.retention",
        "Retention, export, and deletion paths exist",
        contract.dataProtection.retentionPolicy && contract.dataProtection.exportDelete,
        `retentionPolicy=${contract.dataProtection.retentionPolicy}; exportDelete=${contract.dataProtection.exportDelete}`,
      ),
      required(
        "security.compliance.audit_consent",
        "Audit logging and consent tracking exist",
        contract.compliance.auditLog && contract.compliance.consentTracking,
        `auditLog=${contract.compliance.auditLog}; consentTracking=${contract.compliance.consentTracking}`,
      ),
      recommended(
        "security.compliance.evidence",
        "Policy evidence and vendor inventory are maintained",
        contract.compliance.policyEvidence && contract.compliance.vendorInventory,
        `policyEvidence=${contract.compliance.policyEvidence}; vendorInventory=${contract.compliance.vendorInventory}`,
      ),
      required(
        "security.secrets.manager",
        "Secrets are centrally managed and kept out of logs",
        contract.secrets.centralManager && contract.secrets.noPlaintextEnvInLogs,
        `centralManager=${contract.secrets.centralManager}; noPlaintextEnvInLogs=${contract.secrets.noPlaintextEnvInLogs}`,
      ),
      recommended(
        "security.secrets.rotation",
        "Secret rotation runbook exists",
        contract.secrets.rotationRunbook,
        boolEvidence(contract.secrets.rotationRunbook),
      ),
    ],
  });
}

export function assessObservabilityReadiness(contract: ObservabilityReadinessContract): EnterpriseReadinessArea {
  return buildArea({
    id: 12,
    name: "Observability",
    contract: "observability",
    checks: [
      required(
        "observability.logs.structured",
        "Logs are structured",
        contract.logs.structured,
        boolEvidence(contract.logs.structured),
      ),
      required(
        "observability.logs.safe",
        "Logs include correlation IDs and redact sensitive data",
        contract.logs.correlationIds && contract.logs.redaction,
        `correlationIds=${contract.logs.correlationIds}; redaction=${contract.logs.redaction}`,
      ),
      required(
        "observability.metrics.core",
        "Core latency and error-rate metrics exist",
        contract.metrics.latency && contract.metrics.errorRate,
        `latency=${contract.metrics.latency}; errorRate=${contract.metrics.errorRate}`,
      ),
      recommended(
        "observability.metrics.workflow",
        "Queue depth and cost metrics are tracked",
        contract.metrics.queueDepth && contract.metrics.cost,
        `queueDepth=${contract.metrics.queueDepth}; cost=${contract.metrics.cost}`,
      ),
      recommended(
        "observability.tracing",
        "Workflow and provider spans are traced",
        contract.tracing.workflowSpans && contract.tracing.providerSpans,
        `workflowSpans=${contract.tracing.workflowSpans}; providerSpans=${contract.tracing.providerSpans}`,
      ),
      required(
        "observability.alerts",
        "Alerts route to owners with SLO thresholds",
        contract.alerts.onCallRouting && contract.alerts.sloThresholds,
        `onCallRouting=${contract.alerts.onCallRouting}; sloThresholds=${contract.alerts.sloThresholds}`,
      ),
      required(
        "observability.health",
        "Readiness and liveness endpoints exist",
        contract.health.readinessEndpoint && contract.health.livenessEndpoint,
        `readinessEndpoint=${contract.health.readinessEndpoint}; livenessEndpoint=${contract.health.livenessEndpoint}`,
      ),
      recommended(
        "observability.synthetic_publish",
        "Synthetic publish check monitors the workflow",
        contract.health.syntheticPublish,
        boolEvidence(contract.health.syntheticPublish),
      ),
    ],
  });
}

export function assessDeploymentReadiness(contract: DeploymentReadinessContract): EnterpriseReadinessArea {
  return buildArea({
    id: 16,
    name: "Deployment Readiness",
    contract: "deployment",
    checks: [
      required(
        "deployment.environments.prod",
        "Production is isolated from lower environments",
        contract.environments.separateProd,
        boolEvidence(contract.environments.separateProd),
      ),
      required(
        "deployment.environments.promotion",
        "Promotion path and config validation exist",
        contract.environments.promotionPath && contract.environments.configValidation,
        `promotionPath=${contract.environments.promotionPath}; configValidation=${contract.environments.configValidation}`,
      ),
      required(
        "deployment.releases.zero_downtime",
        "Release process supports zero-downtime deploys",
        contract.releases.zeroDowntime,
        boolEvidence(contract.releases.zeroDowntime),
      ),
      required(
        "deployment.releases.rollback",
        "Release rollback and smoke tests exist",
        contract.releases.rollback && contract.releases.smokeTests,
        `rollback=${contract.releases.rollback}; smokeTests=${contract.releases.smokeTests}`,
      ),
      required(
        "deployment.releases.migration_gate",
        "Deploys gate risky migrations",
        contract.releases.migrationGate,
        boolEvidence(contract.releases.migrationGate),
      ),
      required(
        "deployment.operations.runbook",
        "Operational runbook exists",
        contract.operations.runbook,
        boolEvidence(contract.operations.runbook),
      ),
      recommended(
        "deployment.operations.capacity",
        "Scaling plan and dependency checks exist",
        contract.operations.scalingPlan && contract.operations.dependencyChecks,
        `scalingPlan=${contract.operations.scalingPlan}; dependencyChecks=${contract.operations.dependencyChecks}`,
      ),
      recommended(
        "deployment.operations.failover",
        "Region failover plan exists",
        contract.operations.regionFailover,
        boolEvidence(contract.operations.regionFailover),
      ),
      recommended(
        "deployment.safety.progressive",
        "Feature flags and canary releases are available",
        contract.safety.featureFlags && contract.safety.canary,
        `featureFlags=${contract.safety.featureFlags}; canary=${contract.safety.canary}`,
      ),
      required(
        "deployment.safety.backups",
        "Backups are taken before migrations",
        contract.safety.backupsBeforeMigrate,
        boolEvidence(contract.safety.backupsBeforeMigrate),
      ),
    ],
  });
}

export function buildEnterpriseReadinessReport(input: EnterpriseReadinessInput): EnterpriseReadinessReport {
  const areas = [
    assessProductionDatabaseReadiness(input.productionDatabase),
    assessDurableWorkflowEngineReadiness(input.durableWorkflowEngine),
    assessPublishingVersioningCustomDomainReadiness(input.publishingVersioningCustomDomain),
    assessSecurityComplianceReadiness(input.securityCompliance),
    assessObservabilityReadiness(input.observability),
    assessDeploymentReadiness(input.deployment),
  ];
  const checks = areas.flatMap((area) => area.checks);
  const blockers = flattenCheckMessages(areas, "fail");
  const warnings = flattenCheckMessages(areas, "warn");
  const passed = checks.filter((check) => check.state === "pass").length;
  const score = checks.length > 0 ? Math.round((passed / checks.length) * 100) : 0;

  return {
    schema_version: "myfunnela.enterprise-readiness.v1",
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "needs_attention" : "ready",
    score,
    areas,
    blockers,
    warnings,
  };
}

function buildArea(args: {
  id: EnterpriseReadinessAreaId;
  name: string;
  contract: string;
  checks: EnterpriseReadinessCheck[];
}): EnterpriseReadinessArea {
  const failedRequired = args.checks.some((check) => check.state === "fail");
  const warnings = args.checks.some((check) => check.state === "warn");
  const passed = args.checks.filter((check) => check.state === "pass").length;

  return {
    id: args.id,
    name: args.name,
    contract: args.contract,
    status: failedRequired ? "blocked" : warnings ? "needs_attention" : "ready",
    summary: `${passed}/${args.checks.length} checks passing for ${args.name}.`,
    checks: args.checks,
  };
}

function required(id: string, label: string, passed: boolean, evidence: string): EnterpriseReadinessCheck {
  return {
    id,
    label,
    state: passed ? "pass" : "fail",
    severity: "required",
    evidence,
  };
}

function recommended(id: string, label: string, passed: boolean, evidence: string): EnterpriseReadinessCheck {
  return {
    id,
    label,
    state: passed ? "pass" : "warn",
    severity: "recommended",
    evidence,
  };
}

function flattenCheckMessages(
  areas: EnterpriseReadinessArea[],
  state: "fail" | "warn",
): string[] {
  return areas.flatMap((area) =>
    area.checks
      .filter((check) => check.state === state)
      .map((check) => `${area.id}.${check.id}: ${check.label}`),
  );
}

function boolEvidence(value: boolean): string {
  return `configured=${value}`;
}
