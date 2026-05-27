/**
 * Deliverability helpers.
 *
 *   - Hard/soft bounce + complaint classification (from Resend webhooks).
 *   - Domain reputation throttle — caller computes rolling bounce/complaint
 *     rates and asks `shouldThrottle(domain)` before sending; the engine
 *     auto-throttles to 10% of cap when bounce > 5% OR complaint > 0.3%.
 *   - Brand-side SPF / DKIM / DMARC config is documented in providers/resend.ts.
 */

export const MAX_BOUNCE_RATE = 0.05;
export const MAX_COMPLAINT_RATE = 0.003;

export interface DomainReputation {
  domain: string;
  bounces_24h: number;
  complaints_24h: number;
  sends_24h: number;
}

export function shouldThrottle(rep: DomainReputation): boolean {
  if (rep.sends_24h < 100) return false;
  const bounceRate = rep.bounces_24h / rep.sends_24h;
  const complaintRate = rep.complaints_24h / rep.sends_24h;
  return bounceRate > MAX_BOUNCE_RATE || complaintRate > MAX_COMPLAINT_RATE;
}

export type ResendEventType = "delivered" | "bounced" | "complained" | "opened" | "clicked" | "failed";

export interface NormalizedEvent {
  type: ResendEventType;
  message_id: string;
  email: string;
  reason?: string;
  ts: string;
}
