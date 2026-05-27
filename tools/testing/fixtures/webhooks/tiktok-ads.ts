import { createHmac } from "node:crypto";

const SECRET = process.env.TIKTOK_WEBHOOK_SECRET ?? "test-tiktok-secret";

export function tiktokSignature(body: string, timestamp: number): string {
  return createHmac("sha256", SECRET).update(`${timestamp}${body}`).digest("hex");
}

export const TIKTOK_LEAD_FORM_SUBMIT = {
  event: "lead_form_submit",
  timestamp: 1_700_000_000,
  data: {
    advertiser_id: "7000000000",
    form_id: "form_tt_1",
    lead_id: "tt_lead_1",
    email: "lead@example.test",
    phone: "+15550009999",
  },
};

export const TIKTOK_AD_REVIEW_REJECTED = {
  event: "ad_review_status_change",
  data: { ad_id: "ad_tt_1", review_status: "REJECTED", reason: "policy_violation" },
};
