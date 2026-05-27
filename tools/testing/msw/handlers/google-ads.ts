import { http, HttpResponse } from "msw";

export const googleAdsHandlers = [
  http.post("https://oauth2.googleapis.com/token", () =>
    HttpResponse.json({ access_token: "g-test-token", expires_in: 3600, token_type: "Bearer" }),
  ),
  http.post("https://googleads.googleapis.com/v18/customers/:id:mutate", () =>
    HttpResponse.json({ results: [{ resourceName: "customers/123/campaigns/456" }] }),
  ),
  http.post("https://googleads.googleapis.com/v18/customers/:id/googleAds:search", () =>
    HttpResponse.json({
      results: [
        {
          metrics: { impressions: "1500", clicks: "45", costMicros: "13500000", ctr: "0.03" },
        },
      ],
    }),
  ),
];
