/**
 * SignalWire adapter — voice + SMS + Lookup.
 *
 * Capability: REVIEW-GATED for outbound voice (DNC + TCPA hard gates),
 *             DIRECT for SMS (still gated by per-recipient opt-out upstream)
 *             and Lookup (read-only).
 * Auth: HTTP Basic — SIGNALWIRE_PROJECT_ID : SIGNALWIRE_API_TOKEN.
 * Base URL: `https://${SIGNALWIRE_SPACE_URL}` (Twilio-compatible REST API at
 *           `/api/laml/2010-04-01/Accounts/${ProjectId}/...`).
 *
 * IMPORTANT: This adapter does NOT itself talk to the DNC list. The DNC check
 * is a hard gate enforced by `apps/workers/src/workers/sms.ts` and the voice
 * worker BEFORE this adapter is invoked. If you ever call `sendVoice` from a
 * code path that did not run the DNC check, fix the caller — do not loosen
 * the gate here.
 *
 * Webhook signature verification lives in
 * `apps/api/src/webhooks/signalwire.ts` (Twilio-compatible HMAC-SHA1).
 */

import { BaseAdapter, type BaseAdapterConfig } from "../pal/base-adapter.js";
import { PermanentError } from "../pal/errors.js";
import type {
  ConnectResult,
  ListFilters,
  ListResult,
  ProviderLimits,
  ResourceType,
  StatusResult,
  WebhookEvent,
  WorkspaceId,
  WriteOptions,
} from "../pal/types.js";

export interface SignalwireConfig {
  /** SignalWire Project ID (replaces TWILIO_ACCOUNT_SID). */
  projectId: string;
  /** SignalWire API token (replaces TWILIO_AUTH_TOKEN). */
  apiToken: string;
  /** e.g. "your-space.signalwire.com" — required, no default. */
  spaceUrl: string;
  /** Default From: number for outbound SMS / voice (E.164). */
  defaultFromNumber?: string;
}

export interface SendSmsInput {
  from: string;
  to: string;
  body: string;
  idempotency_key?: string;
}

export interface SendSmsResult {
  message_id: string;
  accepted: boolean;
  status?: string;
}

export interface PlaceVoiceCallInput {
  from: string;
  to: string;
  /** Either a URL serving SignalWireML/TwiML, or inline TwiML in `twiml`. */
  url?: string;
  twiml?: string;
  /** Optional status-callback URL for state transitions. */
  statusCallback?: string;
  idempotency_key?: string;
}

export interface PlaceVoiceCallResult {
  call_id: string;
  accepted: boolean;
  status?: string;
}

export interface LookupInput {
  phone_e164: string;
  /** Provider-side enrichment toggles. */
  fields?: Array<"line_type" | "carrier" | "caller_name">;
}

export interface LookupResult {
  phone_e164: string;
  valid: boolean;
  country_code?: string;
  carrier?: { name?: string; type?: string };
  caller_name?: string;
}

/** Internal shape returned by SignalWire's LaML REST endpoints. */
interface LamlMessageResponse {
  sid: string;
  status?: string;
}
interface LamlCallResponse {
  sid: string;
  status?: string;
}
interface LamlLookupResponse {
  phone_number: string;
  national_format?: string;
  country_code?: string;
  carrier?: { name?: string; type?: string; mobile_country_code?: string };
  caller_name?: { caller_name?: string };
}

export class SignalwireAdapter extends BaseAdapter {
  private readonly projectId: string;
  private readonly defaultFrom?: string;

  constructor(cfg: SignalwireConfig) {
    if (!cfg.projectId) throw new Error("SignalwireAdapter: projectId is required");
    if (!cfg.apiToken) throw new Error("SignalwireAdapter: apiToken is required");
    if (!cfg.spaceUrl) throw new Error("SignalwireAdapter: spaceUrl is required");
    const basic = Buffer.from(`${cfg.projectId}:${cfg.apiToken}`).toString("base64");
    const baseCfg: BaseAdapterConfig = {
      providerKey: "signalwire",
      version: "1.0.0",
      // Outbound voice is REVIEW-GATED at the orchestrator level (DNC gate is
      // enforced by the caller). SMS + Lookup go DIRECT.
      capabilityFlag: "REVIEW-GATED",
      supportedResources: ["sms", "call", "lookup"],
      baseURL: `https://${cfg.spaceUrl}`,
      headers: {
        Authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      timeoutMs: 30_000,
    };
    super(baseCfg);
    this.projectId = cfg.projectId;
    this.defaultFrom = cfg.defaultFromNumber;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  async connect(workspaceId: WorkspaceId): Promise<ConnectResult> {
    return {
      connectionId: `cn_signalwire_${workspaceId}`,
      externalAccountId: this.projectId,
      scopesGranted: ["sms:write", "voice:write", "lookup:read"],
      refreshAvailable: false,
    };
  }
  async disconnect(): Promise<void> {}
  async status(): Promise<StatusResult> {
    const h = await this.healthCheck();
    return {
      connected: true,
      scopesGranted: ["sms:write", "voice:write", "lookup:read"],
      scopesMissing: [],
      degraded: !h.ok,
    };
  }

  // --------------------------------------------------------------------------
  // PAL surface — dispatches to the channel-specific helpers below.
  // --------------------------------------------------------------------------

  override async create<T = unknown>(
    resource: ResourceType,
    payload: unknown,
    opts: WriteOptions,
  ): Promise<T> {
    this.validateWrite(opts);
    switch (resource) {
      case "sms":
        return (await this.sendSms(payload as SendSmsInput)) as unknown as T;
      case "call":
        return (await this.placeVoiceCall(payload as PlaceVoiceCallInput)) as unknown as T;
      case "lookup":
        return (await this.lookup(payload as LookupInput)) as unknown as T;
      default:
        throw new PermanentError(this.providerKey, "unsupported_resource", `signalwire unsupported ${resource}`);
    }
  }

  override async list<T = unknown>(
    resource: ResourceType,
    _filters: ListFilters,
  ): Promise<ListResult<T>> {
    if (resource !== "sms" && resource !== "call") {
      throw new PermanentError(this.providerKey, "unsupported_resource", `signalwire list ${resource}`);
    }
    const path = resource === "sms" ? "Messages.json" : "Calls.json";
    const res = await this.request<{ messages?: T[]; calls?: T[] }>({
      method: "GET",
      url: `/api/laml/2010-04-01/Accounts/${this.projectId}/${path}`,
    });
    const items = (res.messages ?? res.calls ?? []) as T[];
    return { items };
  }

  // --------------------------------------------------------------------------
  // Channel helpers used by workers and the PAL `create` dispatcher.
  // --------------------------------------------------------------------------

  /**
   * Send an outbound SMS. Callers MUST have already verified the recipient is
   * not opted-out and not on the DNC list — this method does no gating itself.
   */
  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    if (!input.to || !input.body) {
      throw new PermanentError(this.providerKey, "invalid_payload", "sendSms requires to + body");
    }
    const from = input.from ?? this.defaultFrom;
    if (!from) throw new PermanentError(this.providerKey, "invalid_payload", "sendSms requires from or defaultFromNumber");

    const form = new URLSearchParams({ From: from, To: input.to, Body: input.body });
    const res = await this.callWithRetry(
      () =>
        this.request<LamlMessageResponse>({
          method: "POST",
          url: `/api/laml/2010-04-01/Accounts/${this.projectId}/Messages.json`,
          headers: input.idempotency_key ? { "Idempotency-Key": input.idempotency_key } : undefined,
          data: form.toString(),
        }),
      "signalwire.sms.send",
    );
    return {
      message_id: res.sid,
      accepted: !res.status || res.status !== "failed",
      status: res.status,
    };
  }

  /**
   * Place an outbound voice call. CALLER MUST run the DNC hard-gate before
   * invoking. The orchestrator treats this as REVIEW-GATED capability.
   */
  async placeVoiceCall(input: PlaceVoiceCallInput): Promise<PlaceVoiceCallResult> {
    if (!input.to) throw new PermanentError(this.providerKey, "invalid_payload", "placeVoiceCall requires to");
    if (!input.url && !input.twiml) {
      throw new PermanentError(this.providerKey, "invalid_payload", "placeVoiceCall requires url or twiml");
    }
    const from = input.from ?? this.defaultFrom;
    if (!from) throw new PermanentError(this.providerKey, "invalid_payload", "placeVoiceCall requires from or defaultFromNumber");

    const params: Record<string, string> = { From: from, To: input.to };
    if (input.url) params.Url = input.url;
    if (input.twiml) params.Twiml = input.twiml;
    if (input.statusCallback) params.StatusCallback = input.statusCallback;

    const res = await this.callWithRetry(
      () =>
        this.request<LamlCallResponse>({
          method: "POST",
          url: `/api/laml/2010-04-01/Accounts/${this.projectId}/Calls.json`,
          headers: input.idempotency_key ? { "Idempotency-Key": input.idempotency_key } : undefined,
          data: new URLSearchParams(params).toString(),
        }),
      "signalwire.voice.create",
    );
    return { call_id: res.sid, accepted: !res.status || res.status !== "failed", status: res.status };
  }

  /**
   * Lookup carrier / line-type / caller-name for a phone number. Used by the
   * compliance pre-flight to detect landlines vs mobile vs VoIP (TCPA rules
   * differ) and by lead-scoring to detect throwaway numbers.
   */
  async lookup(input: LookupInput): Promise<LookupResult> {
    if (!input.phone_e164) {
      throw new PermanentError(this.providerKey, "invalid_payload", "lookup requires phone_e164");
    }
    const params: Record<string, string> = {};
    const fields = input.fields ?? ["line_type", "carrier"];
    if (fields.length) params.Fields = fields.join(",");

    const res = await this.callWithRetry(
      () =>
        this.request<LamlLookupResponse>({
          method: "GET",
          url: `/api/laml/2010-04-01/Accounts/${this.projectId}/Lookups/${encodeURIComponent(input.phone_e164)}.json`,
          params,
        }),
      "signalwire.lookup",
    );
    return {
      phone_e164: res.phone_number,
      valid: Boolean(res.phone_number),
      country_code: res.country_code,
      carrier: res.carrier ? { name: res.carrier.name, type: res.carrier.type } : undefined,
      caller_name: res.caller_name?.caller_name,
    };
  }

  // --------------------------------------------------------------------------
  // Webhooks — verification + parsing live in apps/api/src/webhooks/signalwire.ts.
  // This adapter exposes the parse path so PAL consumers can ingest events
  // from the verified webhook pipeline.
  // --------------------------------------------------------------------------

  override webhookVerify(): boolean {
    // The HTTP webhook handler does verification — by the time payloads reach
    // the adapter via `webhookHandle`, they're already verified. Returning
    // true is correct for the orchestrator's two-stage pipeline.
    return true;
  }

  override async webhookHandle(verified: unknown): Promise<WebhookEvent[]> {
    const params = verified as Record<string, string>;
    const callSid = params.CallSid;
    const messageSid = params.MessageSid;
    const now = new Date().toISOString();
    if (callSid) {
      return [
        {
          id: callSid,
          type: `call.${params.CallStatus ?? "status"}`,
          resource: "call",
          resourceId: callSid,
          occurredAt: now,
          payload: params,
        },
      ];
    }
    if (messageSid) {
      return [
        {
          id: messageSid,
          type: `sms.${params.MessageStatus ?? params.SmsStatus ?? "status"}`,
          resource: "sms",
          resourceId: messageSid,
          occurredAt: now,
          payload: params,
        },
      ];
    }
    return [];
  }

  limits(): ProviderLimits {
    return {
      // Defaults; real caps are space-specific. Tune per workspace via the
      // governance config.
      rateLimit: { requestsPerSecond: 1, burstBucket: 10 },
      monthlyCost: { estimatedUSD: 100, capUSD: 2000 },
    };
  }

  protected override async ping(): Promise<void> {
    // Account.json is the canonical "is this account live + creds valid" call.
    await this.request({
      method: "GET",
      url: `/api/laml/2010-04-01/Accounts/${this.projectId}.json`,
    });
  }
}

export const signalwireFactory = (config?: Record<string, unknown>) =>
  new SignalwireAdapter({
    projectId: (config?.projectId as string) ?? process.env.SIGNALWIRE_PROJECT_ID ?? "",
    apiToken: (config?.apiToken as string) ?? process.env.SIGNALWIRE_API_TOKEN ?? "",
    spaceUrl: (config?.spaceUrl as string) ?? process.env.SIGNALWIRE_SPACE_URL ?? "",
    defaultFromNumber: (config?.defaultFromNumber as string) ?? process.env.SIGNALWIRE_FROM_NUMBER,
  });
