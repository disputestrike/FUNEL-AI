/**
 * OAuth provider registry.
 *
 * One entry per provider. The `configBuilder` resolves runtime config
 * (client id/secret + scopes) from env. Doc 04 §B is the source of truth for
 * scopes per provider.
 */

import type { Env } from "../lib/env.js";

export type OAuthProviderKey =
  | "meta"
  | "google"
  | "tiktok"
  | "linkedin"
  | "x"
  | "paypal"
  | "stripe"
  | "google-calendar"
  | "microsoft-graph"
  | "calcom";

export type CapabilityFlag = "DIRECT" | "REVIEW-GATED" | "BRIDGED";

export interface OAuthProvider {
  providerKey: OAuthProviderKey;
  label: string;
  category: "ads" | "social" | "payment" | "calendar" | "crm" | "analytics";
  capabilityFlag: CapabilityFlag;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  scopes: string[];
  usePkce: boolean;
  configBuilder: (env: Env) => { clientId: string; clientSecret: string };
  extraAuthorizeParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    providerKey: "meta",
    label: "Meta (Facebook + Instagram)",
    category: "ads",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://www.facebook.com/v20.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v20.0/oauth/access_token",
    scopes: [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_read_engagement",
      "pages_manage_ads",
      "pages_show_list",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
      "leads_retrieval",
    ],
    usePkce: false,
    configBuilder: (env) => ({ clientId: env.META_APP_ID, clientSecret: env.META_APP_SECRET }),
    extraAuthorizeParams: { display: "popup" },
  },
  {
    providerKey: "google",
    label: "Google Ads",
    category: "ads",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    scopes: ["https://www.googleapis.com/auth/adwords", "openid", "email"],
    usePkce: true,
    configBuilder: (env) => ({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
  },
  {
    providerKey: "google-calendar",
    label: "Google Calendar",
    category: "calendar",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    scopes: ["https://www.googleapis.com/auth/calendar.events", "openid", "email"],
    usePkce: true,
    configBuilder: (env) => ({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }),
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
  },
  {
    providerKey: "tiktok",
    label: "TikTok for Business",
    category: "ads",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://business-api.tiktok.com/portal/auth",
    tokenEndpoint: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    scopes: ["ad_account", "audience", "reporting", "lead_generation"],
    usePkce: false,
    configBuilder: (env) => ({ clientId: env.TIKTOK_APP_ID, clientSecret: env.TIKTOK_APP_SECRET }),
  },
  {
    providerKey: "linkedin",
    label: "LinkedIn Marketing",
    category: "ads",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
    tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: [
      "r_ads",
      "rw_ads",
      "r_ads_reporting",
      "r_organization_social",
      "w_organization_social",
      "r_marketing_leadgen_automation",
    ],
    usePkce: false,
    configBuilder: (env) => ({ clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET }),
  },
  {
    providerKey: "x",
    label: "X (Twitter)",
    category: "social",
    capabilityFlag: "REVIEW-GATED",
    authorizationEndpoint: "https://twitter.com/i/oauth2/authorize",
    tokenEndpoint: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    usePkce: true,
    configBuilder: (env) => ({ clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET }),
  },
  {
    providerKey: "paypal",
    label: "PayPal",
    category: "payment",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://www.paypal.com/connect",
    tokenEndpoint: "https://api-m.paypal.com/v1/oauth2/token",
    scopes: ["openid", "profile", "email"],
    usePkce: false,
    configBuilder: (env) => ({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET }),
  },
  {
    providerKey: "stripe",
    label: "Stripe",
    category: "payment",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://connect.stripe.com/oauth/authorize",
    tokenEndpoint: "https://connect.stripe.com/oauth/token",
    scopes: ["read_write"],
    usePkce: false,
    configBuilder: (env) => ({ clientId: env.STRIPE_SECRET_KEY, clientSecret: env.STRIPE_SECRET_KEY }),
  },
  {
    providerKey: "microsoft-graph",
    label: "Microsoft 365 (Calendar + Outlook)",
    category: "calendar",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", "Calendars.ReadWrite", "Mail.Read", "User.Read"],
    usePkce: true,
    configBuilder: (env) => ({ clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET }),
  },
  {
    providerKey: "calcom",
    label: "Cal.com",
    category: "calendar",
    capabilityFlag: "DIRECT",
    authorizationEndpoint: "https://app.cal.com/auth/oauth/authorize",
    tokenEndpoint: "https://app.cal.com/api/oauth/token",
    scopes: ["READ_BOOKING", "WRITE_BOOKING", "READ_USER"],
    usePkce: false,
    configBuilder: (env) => ({ clientId: env.CALCOM_CLIENT_ID, clientSecret: env.CALCOM_CLIENT_SECRET }),
  },
];

export function getProvider(key: OAuthProviderKey): OAuthProvider {
  const p = OAUTH_PROVIDERS.find((p) => p.providerKey === key);
  if (!p) throw new Error(`Unknown OAuth provider: ${key}`);
  return p;
}
