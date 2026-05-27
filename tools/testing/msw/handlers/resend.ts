import { http, HttpResponse } from "msw";

export const resendHandlers = [
  http.post("https://api.resend.com/emails", async ({ request }) => {
    const body = (await request.json()) as { to: string | string[]; subject: string };
    return HttpResponse.json({
      id: "re_" + Math.random().toString(36).slice(2),
      from: "noreply@gofunnelai.com",
      to: body.to,
      subject: body.subject,
      created_at: new Date().toISOString(),
    });
  }),
  http.get("https://api.resend.com/domains", () =>
    HttpResponse.json({ data: [{ id: "dom_test", name: "gofunnelai.com", status: "verified" }] }),
  ),
];
