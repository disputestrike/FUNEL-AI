/**
 * @funnel/sdk — public client SDK.
 *
 * NOTE: This is a thin stub maintained alongside the apps that depend on it.
 * The full SDK lives in a parallel work-stream; this file exists so that
 * `apps/extension` and `apps/mobile` can typecheck and run in dev today.
 *
 * Surface intentionally narrow:
 *   - `FunnelClient` — token-aware HTTP client.
 *   - Lead / Funnel / Audit methods sufficient for the surfaces that import.
 *
 * Do not add features here without coordinating with the SDK roadmap.
 */

export interface FunnelClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  /** Logical surface name — used for User-Agent and analytics tags. */
  surface?: string;
  /** Optional fetch override (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
}

export interface ApiResult<T> {
  data: T;
  requestId?: string;
}

export interface AuditPageInput {
  url: string;
  html?: string;
  screenshotPng?: string;
}

export interface AuditPageResult {
  score: number;
  issues: Array<{ id: string; severity: "low" | "medium" | "high"; message: string }>;
}

export interface ImportFunnelInput {
  source_url: string;
  workspace_id?: string;
}

export interface CreateLeadInput {
  workspace_id?: string;
  email?: string;
  phone_e164?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export class FunnelClient {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string | null>;
  private readonly surface: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: FunnelClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.getToken = opts.getToken;
    this.surface = opts.surface ?? "sdk";
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async auditPage(input: AuditPageInput): Promise<ApiResult<AuditPageResult>> {
    return this.post<AuditPageResult>("/v1/audit/page", input);
  }

  async importFunnel(input: ImportFunnelInput): Promise<ApiResult<{ funnel_id: string }>> {
    return this.post<{ funnel_id: string }>("/v1/funnels/import", input);
  }

  async createLead(input: CreateLeadInput): Promise<ApiResult<{ lead_id: string }>> {
    return this.post<{ lead_id: string }>("/v1/leads", input);
  }

  private async post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    const token = await this.getToken();
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Funnel-Surface": this.surface,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`funnel sdk ${path} ${res.status}`);
    }
    const data = (await res.json()) as T;
    return { data, requestId: res.headers.get("x-request-id") ?? undefined };
  }
}
