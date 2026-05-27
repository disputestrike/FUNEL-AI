/** Minimal funnel JSON shapes — match @funnel/db/schemas/funnel.ts. */
import type { BusinessProfileFixture } from "./industries";

export interface FunnelFixture {
  funnel_id: string;
  workspace_id: string;
  status: "draft" | "published" | "paused" | "watermarked";
  pages: { type: string; headline: string; cta: string }[];
  ads: { platform: string; primary_text: string; headline: string }[];
  emails: { day: number; subject: string }[];
  sms: { day: number; body: string }[];
}

export function fixtureFunnel(bp: BusinessProfileFixture, ws = "ws_test"): FunnelFixture {
  return {
    funnel_id: `fn_${bp.id}`,
    workspace_id: ws,
    status: "published",
    pages: [
      { type: "landing", headline: `Stop overpaying for ${bp.industry}`, cta: "Get my free quote" },
      { type: "thank-you", headline: "We'll call you in 60 seconds", cta: "" },
    ],
    ads: [
      { platform: "meta", primary_text: `${bp.business_name} in ${bp.city}`, headline: bp.offer },
      { platform: "google", primary_text: bp.audience, headline: `${bp.offer} | ${bp.city}` },
    ],
    emails: [
      { day: 0, subject: "Thanks for reaching out" },
      { day: 1, subject: "Quick question…" },
      { day: 3, subject: "Last chance" },
    ],
    sms: [
      { day: 0, body: "Hey, this is " + bp.business_name + ". Reply STOP to opt out." },
    ],
  };
}
