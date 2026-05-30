import type {
  AgentName,
  AuditResultPayload,
  AuditStreamEvent,
  FinalScore,
  Improvement,
} from "@funnel/shared";

type MockAudit = {
  id: string;
  url: string;
  hostname: string;
  shareCode: string;
  createdAt: string;
};

const globalForAudits = globalThis as typeof globalThis & {
  __gofunnel_mock_audits?: Map<string, MockAudit>;
};

function store() {
  globalForAudits.__gofunnel_mock_audits ??= new Map<string, MockAudit>();
  return globalForAudits.__gofunnel_mock_audits;
}

export function createMockAudit(url: string): MockAudit {
  const urlObj = new URL(url);
  const audit: MockAudit = {
    id: `aud_${Date.now().toString(36)}`,
    url: urlObj.toString(),
    hostname: urlObj.hostname,
    shareCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  store().set(audit.id, audit);
  return audit;
}

export function getMockAudit(id: string): MockAudit | null {
  return store().get(id) ?? null;
}

const improvements: Improvement[] = [
  {
    id: "imp-hook",
    category: "hook",
    title: "Make the promise more specific.",
    detail: "Lead with the exact result visitors get before they talk to sales.",
    before: "Grow your business today",
    after: "Get a free conversion plan for your landing page in 15 seconds",
    estimated_lift: "high",
    effort: "low",
  },
  {
    id: "imp-form",
    category: "form",
    title: "Reduce form friction.",
    detail: "Ask for name, email, and one qualifying field first, then collect detail later.",
    estimated_lift: "medium",
    effort: "low",
  },
  {
    id: "imp-trust",
    category: "trust",
    title: "Move proof above the first CTA.",
    detail: "Add testimonials, badges, or quantified proof before asking for the conversion.",
    estimated_lift: "medium",
    effort: "medium",
  },
];

export function mockAuditPayload(audit: MockAudit): AuditResultPayload {
  const score: FinalScore = {
    overall: 86,
    grade: "A",
    subscores: {
      hook: 88,
      form: 82,
      trust: 84,
      speed: 91,
      compliance: 85,
    },
    critique:
      "This page is launchable, but it needs a clearer free-value promise and proof closer to the first CTA.",
    improvements,
    confidence: "medium",
    degraded_agents: [],
  };

  const agent_runs: AuditResultPayload["agent_runs"] = {
    hook: { model: "local-fallback", ms: 120, ok: true },
    form: { model: "local-fallback", ms: 110, ok: true },
    trust: { model: "local-fallback", ms: 105, ok: true },
    speed: { model: "local-fallback", ms: 90, ok: true },
    compliance: { model: "local-fallback", ms: 95, ok: true },
  };

  return {
    audit_id: audit.id,
    url: audit.url,
    fetched_at: audit.createdAt,
    status: "done",
    screenshot_url: null,
    share_code: audit.shareCode,
    pdf_url: null,
    preview_funnel_id: `preview_${audit.id}`,
    cached: false,
    score,
    agent_runs,
  };
}

export function mockAuditEvents(audit: MockAudit): AuditStreamEvent[] {
  const payload = mockAuditPayload(audit);
  const agents = Object.entries(payload.score?.subscores ?? {}) as Array<[AgentName, number]>;
  return [
    { type: "queued", audit_id: audit.id },
    { type: "rendering", audit_id: audit.id },
    { type: "scoring", audit_id: audit.id },
    ...agents.map(([agent, subscore]) => ({
      type: "agent_completed" as const,
      audit_id: audit.id,
      agent,
      subscore,
      ms: 100,
      ok: true,
    })),
    { type: "done", audit_id: audit.id, payload },
  ];
}
