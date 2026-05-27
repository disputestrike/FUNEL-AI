import { http, HttpResponse } from "msw";

export const metaHandlers = [
  http.post("https://graph.facebook.com/v20.0/oauth/access_token", () =>
    HttpResponse.json({ access_token: "meta-test-token", token_type: "bearer", expires_in: 5184000 }),
  ),
  http.post("https://graph.facebook.com/v20.0/act_:accountId/campaigns", ({ params }) =>
    HttpResponse.json({ id: "23847_" + params.accountId, name: "Test Campaign" }),
  ),
  http.post("https://graph.facebook.com/v20.0/act_:accountId/adsets", () =>
    HttpResponse.json({ id: "23848_adset" }),
  ),
  http.post("https://graph.facebook.com/v20.0/act_:accountId/ads", () =>
    HttpResponse.json({ id: "23849_ad" }),
  ),
  http.post("https://graph.facebook.com/v20.0/act_:accountId/adcreatives", () =>
    HttpResponse.json({ id: "23850_creative" }),
  ),
  http.get("https://graph.facebook.com/v20.0/act_:accountId/insights", () =>
    HttpResponse.json({
      data: [{ impressions: "1000", clicks: "30", spend: "12.34", ctr: "3.0" }],
    }),
  ),
];
