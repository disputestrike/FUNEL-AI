import { createHmac } from "node:crypto";

const SECRET = process.env.META_APP_SECRET ?? "test-meta-app-secret";

/** Meta uses X-Hub-Signature-256: sha256=<hex(hmac-sha256(body, app_secret))>. */
export function metaSignature(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
}

export const META_LEADGEN = {
  entry: [
    {
      id: "page_test_1",
      changes: [
        {
          field: "leadgen",
          value: {
            leadgen_id: "leadgen_123",
            page_id: "page_test_1",
            form_id: "form_456",
            created_time: 1_700_000_000,
            ad_id: "ad_789",
            adset_id: "adset_321",
            campaign_id: "camp_111",
          },
        },
      ],
    },
  ],
  object: "page",
};

export const META_AD_ACCOUNT_BUSINESS_STATUS_CHANGE = {
  entry: [
    {
      id: "act_test_1",
      changes: [{ field: "account_status", value: { status: "DISAPPROVED" } }],
    },
  ],
  object: "ad_account",
};
