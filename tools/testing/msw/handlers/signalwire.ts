import { http, HttpResponse } from "msw";

export const signalwireHandlers = [
  // SignalWire LaML REST (Twilio-compatible). We mock the Calls + Messages create endpoints.
  http.post(
    "https://*.signalwire.com/api/laml/2010-04-01/Accounts/:sid/Calls.json",
    async ({ params }) => {
      return HttpResponse.json({
        sid: "CA_test_" + params.sid,
        status: "queued",
        from: "+15550001111",
        to: "+15550002222",
        direction: "outbound-api",
      });
    },
  ),
  http.post(
    "https://*.signalwire.com/api/laml/2010-04-01/Accounts/:sid/Messages.json",
    async () => {
      return HttpResponse.json({
        sid: "SM_test",
        status: "queued",
        body: "Mock SMS",
      });
    },
  ),
  // Voice AI / RELAY token endpoint.
  http.post("https://*.signalwire.com/api/relay/v3/jwt", () =>
    HttpResponse.json({ jwt_token: "jwt.test.token", refresh_token: "rt.test.token" }),
  ),
];
