/**
 * SignalWire status callbacks are signed Twilio-style:
 * X-Twilio-Signature = base64(hmac-sha1(`${url}${sortedFormValues}`, secret)).
 */
import { createHmac } from "node:crypto";

const SECRET = process.env.SIGNALWIRE_WEBHOOK_SECRET ?? "test-sw-secret";

export function swSignature(url: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join("");
  return createHmac("sha1", SECRET).update(url + sorted).digest("base64");
}

export const SW_CALL_STATUS_COMPLETED = {
  CallSid: "CA_test_call_1",
  CallStatus: "completed",
  CallDuration: "47",
  From: "+15550001111",
  To: "+15550002222",
};

export const SW_CALL_STATUS_FAILED = {
  CallSid: "CA_test_call_fail",
  CallStatus: "failed",
  ErrorCode: "13225",
  ErrorMessage: "Invalid To phone number",
};

export const SW_SMS_STATUS_DELIVERED = {
  MessageSid: "SM_test_sms",
  MessageStatus: "delivered",
  To: "+15550002222",
};
