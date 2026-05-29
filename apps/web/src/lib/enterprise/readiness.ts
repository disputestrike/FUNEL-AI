import type {
  AdminOperationCapability,
  AdminRole,
  EnterpriseObservabilityDashboard,
  EnterpriseOwner,
  EnterpriseReadinessArea,
  EnterpriseReadinessAreaId,
  EnterpriseReadinessControl,
  EnterpriseReadinessSnapshot,
  EnterpriseReadinessSourceItem,
  EnvCheckMode,
  EnvCredentialCheck,
  ObservabilityMetric,
  ReadinessRisk,
  ReadinessState,
} from "./types";

type LocalEnv = Readonly<Record<string, string | undefined>>;

interface CredentialRequirement {
  id: string;
  label: string;
  mode: EnvCheckMode;
  required: boolean;
  purpose: string;
  keys: readonly string[];
}

interface ReadinessAreaDefinition {
  id: EnterpriseReadinessAreaId;
  sourceItem: EnterpriseReadinessSourceItem;
  title: string;
  summary: string;
  owner: EnterpriseOwner;
  risk: ReadinessRisk;
  credentials: readonly CredentialRequirement[];
  controls: readonly EnterpriseReadinessControl[];
  evidence: readonly string[];
  nextActions: readonly string[];
}

const SNAPSHOT_AS_OF = "2026-05-29";

const AREA_DEFINITIONS = [
  {
    id: "enterprise_identity",
    sourceItem: 2,
    title: "Enterprise identity readiness",
    summary: "SSO, WebAuthn MFA, admin RBAC, offboarding, and break-glass coverage for enterprise access.",
    owner: "Security",
    risk: "high",
    credentials: [
      {
        id: "google_workspace_oidc",
        label: "Google Workspace OIDC",
        mode: "all",
        required: true,
        purpose: "Internal and enterprise SSO without password fallback.",
        keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      },
      {
        id: "workspace_domain",
        label: "Workspace domain allow-list",
        mode: "any",
        required: true,
        purpose: "Restricts admin access to approved employee domains.",
        keys: ["GOOGLE_WORKSPACE_DOMAIN", "ADMIN_ALLOWED_EMAIL_DOMAINS"],
      },
      {
        id: "webauthn_admin_mfa",
        label: "WebAuthn admin MFA",
        mode: "all",
        required: true,
        purpose: "Binds admin sessions to a passkey or hardware security key.",
        keys: ["ADMIN_WEBAUTHN_RP_ID", "ADMIN_WEBAUTHN_ORIGIN"],
      },
      {
        id: "admin_session_signing",
        label: "Admin session signing",
        mode: "any",
        required: true,
        purpose: "Signs staff-only sessions and impersonation claims.",
        keys: ["ADMIN_SESSION_SECRET", "NEXTAUTH_SECRET"],
      },
    ],
    controls: [
      {
        id: "role_matrix",
        label: "Five-role admin matrix",
        state: "ready",
        required: true,
        evidence: "read_only, support, billing_admin, engineering, and super_admin roles are modeled locally.",
      },
      {
        id: "no_password_fallback",
        label: "No password fallback posture",
        state: "ready",
        required: true,
        evidence: "Readiness contract requires OIDC plus WebAuthn before enterprise pilot.",
      },
      {
        id: "break_glass",
        label: "Break-glass path documented",
        state: "needs_configuration",
        required: true,
        evidence: "Requires two named SRE leads and vault-backed recovery secret before launch.",
      },
    ],
    evidence: [
      "Admin access is scoped to employee SSO plus WebAuthn.",
      "PII access is limited to super_admin with explicit scope.",
      "Role changes are treated as session-recheck events.",
    ],
    nextActions: [
      "Set Google Workspace OIDC credentials and allowed domains.",
      "Configure WebAuthn RP values for the admin origin.",
      "Nominate and record two break-glass SRE owners.",
    ],
  },
  {
    id: "signalwire_automation",
    sourceItem: 10,
    title: "SignalWire automation readiness",
    summary: "Voice and SMS follow-up automation, sender configuration, webhook handling, and consent guardrails.",
    owner: "Voice",
    risk: "high",
    credentials: [
      {
        id: "signalwire_project",
        label: "SignalWire project",
        mode: "all",
        required: true,
        purpose: "Authenticates SMS, voice, lookup, and status callback calls.",
        keys: ["SIGNALWIRE_PROJECT_ID"],
      },
      {
        id: "signalwire_token",
        label: "SignalWire API token",
        mode: "any",
        required: true,
        purpose: "Signs SignalWire-compatible REST API requests.",
        keys: ["SIGNALWIRE_API_TOKEN", "SIGNALWIRE_AUTH_TOKEN", "SIGNALWIRE_TOKEN"],
      },
      {
        id: "signalwire_space",
        label: "SignalWire space URL",
        mode: "all",
        required: true,
        purpose: "Pins API traffic to the correct SignalWire space.",
        keys: ["SIGNALWIRE_SPACE_URL"],
      },
      {
        id: "signalwire_sender",
        label: "SignalWire sender number",
        mode: "all",
        required: true,
        purpose: "Provides a verified E.164 caller ID and SMS sender.",
        keys: ["SIGNALWIRE_FROM_NUMBER"],
      },
      {
        id: "signalwire_webhooks",
        label: "SignalWire webhook URLs",
        mode: "any",
        required: false,
        purpose: "Enables local deployment wiring for inbound SMS and call status callbacks.",
        keys: ["SIGNALWIRE_INBOUND_SMS_URL", "SIGNALWIRE_STATUS_CALLBACK_URL", "SIGNALWIRE_ANSWER_URL"],
      },
    ],
    controls: [
      {
        id: "tcpa_quiet_hours",
        label: "TCPA quiet-hour guardrail",
        state: "ready",
        required: true,
        evidence: "Automation readiness requires opt-in and quiet-hour checks before live sends.",
      },
      {
        id: "opt_out_ack",
        label: "STOP/HELP inbound handling",
        state: "ready",
        required: true,
        evidence: "Inbound handling is tracked as a launch requirement for SMS consent.",
      },
      {
        id: "dlq_replay",
        label: "Webhook retry and DLQ replay",
        state: "needs_configuration",
        required: true,
        evidence: "Operations action exists in the capability matrix; queue wiring still needs environment confirmation.",
      },
    ],
    evidence: [
      "SignalWire is the voice and SMS provider of record.",
      "Twilio-compatible signatures are expected on inbound webhooks.",
      "Qualified leads can be routed to SMS or voice once credentials are present.",
    ],
    nextActions: [
      "Set project, token, space URL, and sender number.",
      "Publish inbound SMS, answer, and status callback URLs for the deployment.",
      "Run a local webhook replay against the deterministic fixture before enabling sends.",
    ],
  },
  {
    id: "observability_dashboard",
    sourceItem: 12,
    title: "Observability dashboard data",
    summary: "Typed dashboard data for readiness score, blocker count, alert coverage, and enterprise automation panels.",
    owner: "SRE",
    risk: "medium",
    credentials: [
      {
        id: "pagerduty_alerting",
        label: "PagerDuty routing",
        mode: "any",
        required: false,
        purpose: "Routes enterprise readiness and automation incidents to on-call.",
        keys: ["PAGERDUTY_ROUTING_KEY", "PAGERDUTY_SERVICE_ID"],
      },
      {
        id: "incident_channel",
        label: "Incident channel",
        mode: "any",
        required: false,
        purpose: "Sends operational status changes to the incident channel.",
        keys: ["SLACK_INCIDENTS_WEBHOOK_URL", "OPS_ALERTS_WEBHOOK_URL"],
      },
      {
        id: "release_identity",
        label: "Release identity",
        mode: "any",
        required: false,
        purpose: "Annotates snapshots by release when deployed.",
        keys: ["RELEASE", "VERCEL_GIT_COMMIT_SHA", "RAILWAY_GIT_COMMIT_SHA"],
      },
    ],
    controls: [
      {
        id: "dashboard_schema",
        label: "Dashboard schema",
        state: "ready",
        required: true,
        evidence: "Metrics and panels are exported as typed local data from this slice.",
      },
      {
        id: "no_network_probe",
        label: "No network probes",
        state: "ready",
        required: true,
        evidence: "Readiness is derived only from local environment and static contracts.",
      },
      {
        id: "slo_rollup",
        label: "SLO rollup placeholders",
        state: "ready",
        required: true,
        evidence: "Identity, SignalWire, admin operations, and alert coverage are exposed as dashboard metrics.",
      },
    ],
    evidence: [
      "The JSON API is cache-disabled for live local configuration reads.",
      "Dashboard panels reference stable metric IDs.",
      "No customer PII is included in readiness output.",
    ],
    nextActions: [
      "Wire the metric IDs into Grafana or the production dashboard sync when that stack is available.",
      "Set PagerDuty and incident channel environment keys for alert coverage.",
    ],
  },
  {
    id: "admin_operations",
    sourceItem: 14,
    title: "Admin and operations readiness",
    summary: "Staff console capability matrix for support, billing, engineering, audit, impersonation, and internal notes.",
    owner: "Operations",
    risk: "high",
    credentials: [
      {
        id: "ticketing_integration",
        label: "Ticketing integration",
        mode: "any",
        required: false,
        purpose: "Validates justification_ticket_id on mutating admin actions.",
        keys: ["ADMIN_TICKETING_PROJECT_KEY", "LINEAR_API_KEY", "ZENDESK_API_TOKEN"],
      },
      {
        id: "impersonation_secret",
        label: "Impersonation signing secret",
        mode: "any",
        required: true,
        purpose: "Signs customer-view impersonation claims and session expiry metadata.",
        keys: ["ADMIN_IMPERSONATION_SECRET", "ADMIN_SESSION_SECRET"],
      },
      {
        id: "audit_sink",
        label: "Audit event sink",
        mode: "any",
        required: false,
        purpose: "Routes append-only admin events to the audit pipeline.",
        keys: ["AUDIT_LOG_STREAM_URL", "EVENTS_BRIDGE_URL"],
      },
    ],
    controls: [
      {
        id: "ticket_required_writes",
        label: "Ticket required for writes",
        state: "ready",
        required: true,
        evidence: "Mutating capabilities carry requiresTicket metadata for server enforcement.",
      },
      {
        id: "impersonation_guardrails",
        label: "Impersonation guardrails",
        state: "ready",
        required: true,
        evidence: "Reason, ticket, max duration, force termination, and banner requirements are modeled.",
      },
      {
        id: "insert_only_audit",
        label: "Append-only audit posture",
        state: "needs_configuration",
        required: true,
        evidence: "Database role enforcement is outside this bounded web slice and remains a launch gate.",
      },
    ],
    evidence: [
      "All staff writes map to explicit audit event names.",
      "Capability data is role-scoped and can be rendered without exposing PII.",
      "Internal notes are modeled as customer-invisible operations.",
    ],
    nextActions: [
      "Set impersonation and admin session signing secrets.",
      "Connect ticket validation before enabling mutating actions.",
      "Confirm audit log insert-only database permissions in the admin service.",
    ],
  },
] as const satisfies readonly ReadinessAreaDefinition[];

export const ADMIN_ROLES = [
  "read_only",
  "support",
  "billing_admin",
  "engineering",
  "super_admin",
] as const satisfies readonly AdminRole[];

export const ADMIN_OPERATION_CAPABILITIES = [
  {
    id: "view_dashboards",
    label: "View dashboards",
    allowedRoles: ["read_only", "support", "billing_admin", "engineering", "super_admin"],
    requiresTicket: false,
    auditEvent: "admin_dashboard_viewed",
    notes: "Aggregate only; no raw PII.",
  },
  {
    id: "search_users_workspaces",
    label: "Search users and workspaces",
    allowedRoles: ["support", "billing_admin", "engineering", "super_admin"],
    requiresTicket: false,
    auditEvent: "admin_search_performed",
    notes: "PII fields stay masked unless super_admin PII scope is granted.",
  },
  {
    id: "resend_verification",
    label: "Resend verification",
    allowedRoles: ["support", "billing_admin", "super_admin"],
    requiresTicket: true,
    auditEvent: "user_verification_resent",
    notes: "Customer notification action.",
  },
  {
    id: "password_reset",
    label: "Trigger password reset",
    allowedRoles: ["support", "super_admin"],
    requiresTicket: true,
    auditEvent: "user_password_reset_requested",
    notes: "Actor type is admin.",
  },
  {
    id: "billing_credit_refund",
    label: "Apply credit or issue refund",
    allowedRoles: ["billing_admin", "super_admin"],
    requiresTicket: true,
    auditEvent: "admin_billing_adjustment_recorded",
    notes: "Billing admin cap is expected server-side.",
  },
  {
    id: "retry_delivery",
    label: "Retry webhook or background job",
    allowedRoles: ["support", "billing_admin", "engineering", "super_admin"],
    requiresTicket: true,
    auditEvent: "admin_delivery_retry_requested",
    notes: "Engineering can force retry from DLQ.",
  },
  {
    id: "restore_funnel",
    label: "Restore deleted funnel",
    allowedRoles: ["engineering", "super_admin"],
    requiresTicket: true,
    auditEvent: "account_restored",
    notes: "Requires audit and owner notification.",
  },
  {
    id: "internal_note",
    label: "Add internal note",
    allowedRoles: ["support", "billing_admin", "engineering", "super_admin"],
    requiresTicket: false,
    auditEvent: "internal_note_added",
    notes: "Customer never sees the note.",
  },
  {
    id: "impersonate",
    label: "Impersonate workspace owner",
    allowedRoles: ["super_admin"],
    requiresTicket: true,
    auditEvent: "impersonation_started",
    notes: "Requires reason, expiry, banner, and action summary.",
  },
  {
    id: "force_terminate_impersonation",
    label: "Force-terminate impersonation",
    allowedRoles: ["engineering", "super_admin"],
    requiresTicket: true,
    auditEvent: "impersonation_ended",
    notes: "Used during incident response.",
  },
] as const satisfies readonly AdminOperationCapability[];

export function buildEnterpriseReadinessSnapshot(env: LocalEnv = process.env): EnterpriseReadinessSnapshot {
  const areas = AREA_DEFINITIONS.map((definition) => buildArea(definition, env));
  const blockerCount = areas.reduce((total, area) => total + area.blockers.length, 0);
  const readyAreas = areas.filter((area) => area.state === "ready").length;
  const overallScore = Math.round(
    areas.reduce((total, area) => total + area.score, 0) / areas.length,
  );
  const overallState = stateFromScore(overallScore, blockerCount);

  return {
    schemaVersion: "enterprise-readiness.v1",
    asOf: SNAPSHOT_AS_OF,
    ok: overallState === "ready",
    environment: "local",
    overall: {
      state: overallState,
      score: overallScore,
      readyAreas,
      totalAreas: areas.length,
      blockerCount,
    },
    areas,
    observability: buildObservabilityDashboard(areas, env),
    adminOperations: {
      roles: ADMIN_ROLES,
      capabilities: ADMIN_OPERATION_CAPABILITIES,
    },
  };
}

function buildArea(definition: ReadinessAreaDefinition, env: LocalEnv): EnterpriseReadinessArea {
  const credentialChecks = definition.credentials.map((credential) => checkCredential(credential, env));
  const requiredCredentials = credentialChecks.filter((credential) => credential.required);
  const requiredControls = definition.controls.filter((control) => control.required);
  const totalRequired = requiredCredentials.length + requiredControls.length;
  const passedRequired =
    requiredCredentials.filter((credential) => credential.present).length +
    requiredControls.filter((control) => control.state === "ready").length;
  const score = totalRequired === 0 ? 100 : Math.round((passedRequired / totalRequired) * 100);
  const blockers = [
    ...credentialChecks
      .filter((credential) => credential.required && !credential.present)
      .map((credential) => `${credential.label}: ${formatMissingKeys(credential)}`),
    ...definition.controls
      .filter((control) => control.required && control.state !== "ready")
      .map((control) => control.label),
  ];

  return {
    id: definition.id,
    sourceItem: definition.sourceItem,
    title: definition.title,
    summary: definition.summary,
    owner: definition.owner,
    risk: definition.risk,
    state: stateFromScore(score, blockers.length),
    score,
    credentialChecks,
    controls: definition.controls,
    blockers,
    nextActions: blockers.length > 0 ? definition.nextActions : ["Keep this area in the enterprise launch review."],
    evidence: definition.evidence,
  };
}

function checkCredential(requirement: CredentialRequirement, env: LocalEnv): EnvCredentialCheck {
  const presentKeys = requirement.keys.filter((key) => hasValue(env[key]));
  const missingKeys = requirement.keys.filter((key) => !hasValue(env[key]));
  const present = requirement.mode === "all" ? missingKeys.length === 0 : presentKeys.length > 0;

  return {
    ...requirement,
    present,
    presentKeys,
    missingKeys,
  };
}

function buildObservabilityDashboard(
  areas: readonly EnterpriseReadinessArea[],
  env: LocalEnv,
): EnterpriseObservabilityDashboard {
  const readyAreas = areas.filter((area) => area.state === "ready").length;
  const blockerCount = areas.reduce((total, area) => total + area.blockers.length, 0);
  const overallScore = Math.round(areas.reduce((total, area) => total + area.score, 0) / areas.length);
  const alertKeys = ["PAGERDUTY_ROUTING_KEY", "PAGERDUTY_SERVICE_ID", "SLACK_INCIDENTS_WEBHOOK_URL", "OPS_ALERTS_WEBHOOK_URL"];
  const alertCoverage = Math.round((alertKeys.filter((key) => hasValue(env[key])).length / alertKeys.length) * 100);

  const metrics = [
    metric("overall_readiness_score", "Overall readiness score", overallScore, "percent", ">= 90", "SRE", stateFromScore(overallScore, blockerCount)),
    metric("ready_area_count", "Ready areas", readyAreas, "count", "4", "Operations", readyAreas === areas.length ? "ready" : "needs_configuration"),
    metric("configuration_blockers", "Configuration blockers", blockerCount, "count", "0", "Operations", blockerCount === 0 ? "ready" : "needs_configuration"),
    metric("alert_channel_coverage", "Alert channel env coverage", alertCoverage, "percent", ">= 50", "SRE", alertCoverage >= 50 ? "ready" : "needs_configuration"),
    ...areas.map((area) =>
      metric(`${area.id}_score`, area.title, area.score, "percent", ">= 90", area.owner, area.state),
    ),
  ] as const satisfies readonly ObservabilityMetric[];

  return {
    title: "Enterprise readiness dashboard",
    dataSource: "local-readiness-snapshot",
    refreshCadence: "on request",
    metrics,
    panels: [
      {
        id: "readiness_rollup",
        title: "Readiness rollup",
        metricIds: ["overall_readiness_score", "ready_area_count", "configuration_blockers"],
        queryKey: "enterprise.readiness.rollup",
        owner: "SRE",
      },
      {
        id: "identity_and_admin",
        title: "Identity and admin controls",
        metricIds: ["enterprise_identity_score", "admin_operations_score"],
        queryKey: "enterprise.readiness.identity_admin",
        owner: "Security",
      },
      {
        id: "signalwire_automation",
        title: "SignalWire automation",
        metricIds: ["signalwire_automation_score"],
        queryKey: "enterprise.readiness.signalwire",
        owner: "Voice",
      },
      {
        id: "alerts",
        title: "Alert channel coverage",
        metricIds: ["alert_channel_coverage", "observability_dashboard_score"],
        queryKey: "enterprise.readiness.alerts",
        owner: "SRE",
      },
    ],
  };
}

function metric(
  id: string,
  label: string,
  value: number,
  unit: ObservabilityMetric["unit"],
  objective: string,
  owner: EnterpriseOwner,
  state: ReadinessState,
): ObservabilityMetric {
  return {
    id,
    label,
    value,
    unit,
    objective,
    state,
    owner,
  };
}

function stateFromScore(score: number, blockers: number): ReadinessState {
  if (blockers === 0 && score >= 90) return "ready";
  if (score === 0) return "blocked";
  return "needs_configuration";
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function formatMissingKeys(check: EnvCredentialCheck): string {
  if (check.mode === "any") return `set one of ${check.keys.join(", ")}`;
  return check.missingKeys.join(", ");
}
