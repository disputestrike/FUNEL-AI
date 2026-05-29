import { describe, expect, it } from "vitest";

import {
  assessDurableWorkflowEngineReadiness,
  assessProductionDatabaseReadiness,
  buildEnterpriseReadinessReport,
  type EnterpriseReadinessInput,
} from "../src/index.js";

const readyInput: EnterpriseReadinessInput = {
  productionDatabase: {
    engine: "postgres",
    connectionPooling: true,
    migrations: { strategy: "automated", rollback: true, driftDetection: true },
    backup: {
      pointInTimeRecovery: true,
      retentionDays: 14,
      restoreRunbook: true,
      restoreTested: true,
    },
    tenancy: { isolation: "rls", enforcedInQueries: true },
    idempotency: { keys: true, transactionalOutbox: true, uniqueConstraints: true },
    encryption: { atRest: true, inTransit: true, secretsManaged: true },
    audit: { mutationLog: true, actorTracking: true },
  },
  durableWorkflowEngine: {
    engine: "temporal",
    persistence: "database",
    retries: { maxAttempts: 4, backoff: "exponential", deadLetterQueue: true },
    execution: {
      resumable: true,
      idempotentSteps: true,
      stepTimeoutSeconds: 300,
      heartbeat: true,
      cancellation: true,
    },
    effects: {
      transactionalOutbox: true,
      idempotencyKeys: true,
      exactlyOnceClaimsAvoided: true,
    },
    auditEvents: true,
  },
  publishingVersioningCustomDomain: {
    versioning: {
      immutableVersions: true,
      draftPreview: true,
      rollback: true,
      contentHash: true,
    },
    publishing: {
      atomicPublish: true,
      statusTransitions: true,
      publishedAtTracking: true,
    },
    customDomains: {
      supported: true,
      ownershipVerification: true,
      automatedTls: true,
      dnsInstructions: true,
      canonicalRedirect: true,
    },
    assets: { durableStorage: true, cacheInvalidation: true },
  },
  securityCompliance: {
    auth: { sso: true, mfa: true, sessionExpiry: true },
    authorization: { rbac: true, tenantScopedRoles: true, serviceRoleIsolation: true },
    dataProtection: {
      encryptionAtRest: true,
      encryptionInTransit: true,
      piiMinimization: true,
      retentionPolicy: true,
      exportDelete: true,
    },
    compliance: {
      auditLog: true,
      consentTracking: true,
      policyEvidence: true,
      vendorInventory: true,
    },
    secrets: {
      centralManager: true,
      rotationRunbook: true,
      noPlaintextEnvInLogs: true,
    },
  },
  observability: {
    logs: { structured: true, redaction: true, correlationIds: true },
    metrics: { latency: true, errorRate: true, queueDepth: true, cost: true },
    tracing: { workflowSpans: true, providerSpans: true },
    alerts: { onCallRouting: true, sloThresholds: true },
    health: { readinessEndpoint: true, livenessEndpoint: true, syntheticPublish: true },
  },
  deployment: {
    environments: { separateProd: true, promotionPath: true, configValidation: true },
    releases: { zeroDowntime: true, rollback: true, smokeTests: true, migrationGate: true },
    operations: {
      runbook: true,
      scalingPlan: true,
      regionFailover: true,
      dependencyChecks: true,
    },
    safety: { featureFlags: true, canary: true, backupsBeforeMigrate: true },
  },
};

describe("enterprise readiness contracts", () => {
  it("returns a deterministic ready report for all requested enterprise areas", () => {
    const report = buildEnterpriseReadinessReport(readyInput);

    expect(report.schema_version).toBe("myfunnela.enterprise-readiness.v1");
    expect(report.status).toBe("ready");
    expect(report.score).toBe(100);
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.areas.map((area) => area.id)).toEqual([1, 3, 5, 11, 12, 16]);
    expect(report.areas.map((area) => area.contract)).toEqual([
      "production_database",
      "durable_workflow_engine",
      "publishing_versioning_custom_domain",
      "security_compliance",
      "observability",
      "deployment",
    ]);
  });

  it("blocks production database readiness when core storage guarantees are missing", () => {
    const area = assessProductionDatabaseReadiness({
      ...readyInput.productionDatabase,
      engine: "sqlite",
      migrations: { strategy: "none", rollback: false, driftDetection: false },
      backup: {
        pointInTimeRecovery: false,
        retentionDays: 1,
        restoreRunbook: true,
        restoreTested: false,
      },
    });

    expect(area.id).toBe(1);
    expect(area.status).toBe("blocked");
    expect(area.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "database.engine.production", state: "fail" }),
        expect.objectContaining({ id: "database.migrations.automated", state: "fail" }),
        expect.objectContaining({ id: "database.restore_tested", state: "warn" }),
      ]),
    );
  });

  it("separates durable workflow blockers from recommended workflow gaps", () => {
    const area = assessDurableWorkflowEngineReadiness({
      ...readyInput.durableWorkflowEngine,
      persistence: "memory",
      execution: {
        ...readyInput.durableWorkflowEngine.execution,
        heartbeat: false,
        cancellation: false,
      },
      effects: {
        transactionalOutbox: false,
        idempotencyKeys: false,
        exactlyOnceClaimsAvoided: false,
      },
    });

    expect(area.id).toBe(3);
    expect(area.status).toBe("blocked");
    expect(area.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "workflow.persistence.durable", state: "fail" }),
        expect.objectContaining({ id: "workflow.effects.safe", state: "fail" }),
        expect.objectContaining({ id: "workflow.execution.heartbeat", state: "warn" }),
        expect.objectContaining({ id: "workflow.effects.exactly_once_language", state: "warn" }),
      ]),
    );
  });

  it("rolls blockers and warnings into the aggregate report", () => {
    const report = buildEnterpriseReadinessReport({
      ...readyInput,
      publishingVersioningCustomDomain: {
        ...readyInput.publishingVersioningCustomDomain,
        customDomains: {
          ...readyInput.publishingVersioningCustomDomain.customDomains,
          dnsInstructions: false,
        },
      },
      deployment: {
        ...readyInput.deployment,
        releases: {
          ...readyInput.deployment.releases,
          migrationGate: false,
        },
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.score).toBeLessThan(100);
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("16.deployment.releases.migration_gate"),
      ]),
    );
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("5.publishing.custom_domains.dns"),
      ]),
    );
  });
});
