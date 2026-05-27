import { createHmac } from "node:crypto";

const SECRET = process.env.REVTRY_WEBHOOK_SECRET ?? "test-revtry-secret";

export function revtrySignature(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export const REVTRY_CALL_CONNECTED = {
  event_type: "call.connected",
  call_id: "rev_call_1",
  lead_id: "lead_000001",
  outcome: "connected",
  duration_seconds: 122,
  recording_url: "https://recordings.revtry.test/rev_call_1",
};

export const REVTRY_CALL_NO_ANSWER = {
  event_type: "call.no_answer",
  call_id: "rev_call_2",
  lead_id: "lead_000002",
  outcome: "no_answer",
};

export const REVTRY_CALL_BOOKED = {
  event_type: "call.booked",
  call_id: "rev_call_3",
  lead_id: "lead_000003",
  outcome: "booked",
  appointment_at: "2025-01-05T15:00:00Z",
};
