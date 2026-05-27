import { http, HttpResponse } from "msw";

export const linkedinAdsHandlers = [
  http.post("https://www.linkedin.com/oauth/v2/accessToken", () =>
    HttpResponse.json({ access_token: "li-test-token", expires_in: 5184000 }),
  ),
  http.post("https://api.linkedin.com/rest/adCampaigns", () =>
    HttpResponse.json({}, { status: 201, headers: { "x-linkedin-id": "campaign:urn:li:sponsoredCampaign:99999" } }),
  ),
  http.get("https://api.linkedin.com/rest/adAnalytics", () =>
    HttpResponse.json({
      elements: [{ impressions: 500, clicks: 12, costInLocalCurrency: "6.75" }],
    }),
  ),
];
