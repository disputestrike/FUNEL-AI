import { http, HttpResponse } from "msw";

export const revtryHandlers = [
  http.post("https://api.revtry.test/v1/calls", async ({ request }) => {
    const body = (await request.json()) as { lead_id: string };
    return HttpResponse.json({
      call_id: "rev_" + body.lead_id,
      status: "queued",
      eta_seconds: 30,
    });
  }),
  http.get("https://api.revtry.test/v1/calls/:id", ({ params }) =>
    HttpResponse.json({ call_id: params.id, status: "completed", outcome: "connected" }),
  ),
];
