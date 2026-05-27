import { createHmac } from "node:crypto";

const SECRET = process.env.LINKEDIN_WEBHOOK_SECRET ?? "test-li-secret";

export function linkedinSignature(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
}

export const LINKEDIN_LEAD_FORM_RESPONSE = {
  eventType: "leadFormResponse",
  data: {
    formResponseId: "urn:li:leadGenFormResponse:1234",
    sponsoredAccount: "urn:li:sponsoredAccount:507000000",
    formId: "urn:li:leadGenForm:9999",
    submittedAt: 1_700_000_000_000,
    answers: [
      { questionId: "email", answer: "lead@example.test" },
      { questionId: "firstName", answer: "Test" },
    ],
  },
};

export const LINKEDIN_AD_REJECTED = {
  eventType: "creativeReviewStatus",
  data: { creativeId: "urn:li:sponsoredCreative:777", status: "REJECTED" },
};
