import { http, HttpResponse } from "msw";

export const cloudflareHandlers = [
  http.post("https://api.cloudflare.com/client/v4/zones/:zoneId/dns_records", () =>
    HttpResponse.json({
      success: true,
      result: { id: "dns_test", type: "CNAME", name: "x.customer.com", content: "edge.gofunnelai.com" },
    }),
  ),
  http.get("https://api.cloudflare.com/client/v4/zones/:zoneId/ssl/verification", () =>
    HttpResponse.json({ success: true, result: [{ certificate_status: "active" }] }),
  ),
];
