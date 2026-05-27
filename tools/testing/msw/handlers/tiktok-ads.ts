import { http, HttpResponse } from "msw";

export const tiktokAdsHandlers = [
  http.post("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", () =>
    HttpResponse.json({
      code: 0,
      message: "OK",
      data: { access_token: "tt-test-token", advertiser_ids: ["7000000000"] },
    }),
  ),
  http.post("https://business-api.tiktok.com/open_api/v1.3/campaign/create/", () =>
    HttpResponse.json({ code: 0, message: "OK", data: { campaign_id: "1781234567890" } }),
  ),
  http.get("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", () =>
    HttpResponse.json({
      code: 0,
      data: {
        list: [
          { metrics: { impressions: "800", clicks: "20", spend: "8.10", ctr: "2.5" } },
        ],
      },
    }),
  ),
];
