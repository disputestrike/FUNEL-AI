/**
 * OAuth orchestrator. Centralizes the connect → authorize → callback → token
 * exchange flow so adapters only declare *their* OAuth quirks (auth URL,
 * token URL, scopes, PKCE on/off, refresh strategy).
 *
 * Uses `openid-client` for OIDC providers (Google, Microsoft) and a manual
 * code-exchange path for non-OIDC OAuth2 providers (Meta, LinkedIn, TikTok,
 * Twitter, etc.). API-key providers (Stripe, Resend, Anthropic) skip OAuth
 * entirely and call `TokenStore.write` directly with the key.
 */

import { Issuer, generators } from "openid-client";
import { ulid } from "ulid";
import axios from "axios";
import type { OAuthState, TokenBundle } from "../types.js";
import type { OAuthStateStore, TokenStore } from "./store.js";

export interface OAuthProviderConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  /** Either an OIDC discovery URL OR explicit auth+token endpoints. */
  issuerUrl?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  revocationEndpoint?: string;
  scopes: string[];
  /** Many providers (Twitter, Google when not OIDC) require PKCE. */
  usePkce?: boolean;
  /** Some providers (Meta) require `response_type=code` and specific extras. */
  extraAuthorizeParams?: Record<string, string>;
  /** Extra params passed in token-exchange body. */
  extraTokenParams?: Record<string, string>;
}

export interface AuthorizeResponse {
  authorizeUrl: string;
  stateId: string;
  state: OAuthState;
}

export interface OAuthCallbackInput {
  stateId: string;
  code: string;
  /** State value echoed back by the provider — must match what we stored. */
  state?: string;
}

export class OAuthOrchestrator {
  constructor(
    private readonly stateStore: OAuthStateStore,
    private readonly tokenStore: TokenStore,
  ) {}

  /** Begin an authorize flow. Stores per-attempt state in KV, returns the URL. */
  async beginAuthorize(
    cfg: OAuthProviderConfig,
    input: { workspaceId: string; redirectUri: string },
  ): Promise<AuthorizeResponse> {
    const csrf = generators.state();
    const codeVerifier = cfg.usePkce ? generators.codeVerifier() : undefined;
    const codeChallenge = codeVerifier ? generators.codeChallenge(codeVerifier) : undefined;

    const state: OAuthState = {
      workspaceId: input.workspaceId,
      provider: cfg.provider,
      csrf,
      codeVerifier,
      redirectUri: input.redirectUri,
      scopes: cfg.scopes,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    const stateId = await this.stateStore.put(state);

    const authorizeUrl = await this.buildAuthorizeUrl(cfg, {
      redirectUri: input.redirectUri,
      state: csrf,
      codeChallenge,
    });

    return { authorizeUrl, stateId, state };
  }

  /** Complete the flow: validate state, exchange code, persist tokens. */
  async completeAuthorize(
    cfg: OAuthProviderConfig,
    input: OAuthCallbackInput,
  ): Promise<{ vaultPath: string; tokens: TokenBundle; state: OAuthState }> {
    const state = await this.stateStore.get(input.stateId);
    if (!state) throw new Error(`OAuth state ${input.stateId} not found or expired`);
    if (input.state && input.state !== state.csrf) {
      throw new Error("OAuth CSRF state mismatch — possible attack");
    }
    const tokens = await this.exchangeCode(cfg, {
      code: input.code,
      redirectUri: state.redirectUri,
      codeVerifier: state.codeVerifier,
    });
    const vaultPath = await this.tokenStore.write(state.workspaceId, cfg.provider, tokens);
    await this.stateStore.delete(input.stateId);
    return { vaultPath, tokens, state };
  }

  /** Manually persist a static API-key/credential bundle (Stripe, Resend, etc.). */
  async storeApiKey(
    workspaceId: string,
    provider: string,
    apiKey: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    return this.tokenStore.write(workspaceId, provider, {
      accessToken: apiKey,
      metadata,
    });
  }

  /** Force a refresh using a stored refresh_token. */
  async refresh(cfg: OAuthProviderConfig, workspaceId: string): Promise<TokenBundle> {
    const current = await this.tokenStore.read(workspaceId, cfg.provider);
    if (!current?.refreshToken) throw new Error("No refresh token available");

    const tokenEndpoint = cfg.tokenEndpoint ?? (await this.discoverTokenEndpoint(cfg));
    const res = await axios.post(
      tokenEndpoint,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        ...(cfg.extraTokenParams ?? {}),
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    const next: TokenBundle = {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token ?? current.refreshToken,
      expiresAt: res.data.expires_in
        ? new Date(Date.now() + Number(res.data.expires_in) * 1000).toISOString()
        : current.expiresAt,
      metadata: { ...current.metadata, refreshed_at: new Date().toISOString() },
    };
    await this.tokenStore.write(workspaceId, cfg.provider, next);
    return next;
  }

  async revoke(cfg: OAuthProviderConfig, workspaceId: string): Promise<void> {
    const current = await this.tokenStore.read(workspaceId, cfg.provider);
    if (current && cfg.revocationEndpoint) {
      await axios
        .post(
          cfg.revocationEndpoint,
          new URLSearchParams({ token: current.accessToken, client_id: cfg.clientId }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        )
        .catch(() => {
          /* best-effort */
        });
    }
    await this.tokenStore.delete(workspaceId, cfg.provider);
  }

  // ---------------------------------------------------------------------------
  // Internals.
  // ---------------------------------------------------------------------------

  private async buildAuthorizeUrl(
    cfg: OAuthProviderConfig,
    args: { redirectUri: string; state: string; codeChallenge?: string },
  ): Promise<string> {
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: args.redirectUri,
      response_type: "code",
      scope: cfg.scopes.join(" "),
      state: args.state,
      ...(args.codeChallenge
        ? { code_challenge: args.codeChallenge, code_challenge_method: "S256" }
        : {}),
      ...(cfg.extraAuthorizeParams ?? {}),
    });

    if (cfg.authorizationEndpoint) {
      return `${cfg.authorizationEndpoint}?${params.toString()}`;
    }
    if (cfg.issuerUrl) {
      const issuer = await Issuer.discover(cfg.issuerUrl);
      const ep = issuer.metadata.authorization_endpoint;
      if (!ep) throw new Error(`Issuer ${cfg.issuerUrl} has no authorization_endpoint`);
      return `${ep}?${params.toString()}`;
    }
    throw new Error(`OAuth config for ${cfg.provider} has no auth endpoint`);
  }

  private async discoverTokenEndpoint(cfg: OAuthProviderConfig): Promise<string> {
    if (!cfg.issuerUrl) throw new Error(`No tokenEndpoint or issuerUrl for ${cfg.provider}`);
    const issuer = await Issuer.discover(cfg.issuerUrl);
    if (!issuer.metadata.token_endpoint) throw new Error("Issuer has no token_endpoint");
    return issuer.metadata.token_endpoint;
  }

  private async exchangeCode(
    cfg: OAuthProviderConfig,
    args: { code: string; redirectUri: string; codeVerifier?: string },
  ): Promise<TokenBundle> {
    const tokenEndpoint = cfg.tokenEndpoint ?? (await this.discoverTokenEndpoint(cfg));
    const params: Record<string, string> = {
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: args.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      ...(args.codeVerifier ? { code_verifier: args.codeVerifier } : {}),
      ...(cfg.extraTokenParams ?? {}),
    };
    const res = await axios.post(tokenEndpoint, new URLSearchParams(params), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresAt: res.data.expires_in
        ? new Date(Date.now() + Number(res.data.expires_in) * 1000).toISOString()
        : undefined,
      metadata: {
        token_type: res.data.token_type,
        scope: res.data.scope,
        issued_at: new Date().toISOString(),
        id_token: res.data.id_token,
      },
    };
  }

  /** Build a stub OAuthState for tests/internal usage. */
  static buildState(workspaceId: string, provider: string, redirectUri: string, scopes: string[]): OAuthState {
    return {
      workspaceId,
      provider,
      csrf: ulid(),
      redirectUri,
      scopes,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }
}
