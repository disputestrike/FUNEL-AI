/**
 * Lightweight Mixpanel-compatible analytics wrapper.
 *
 * We don't import Mixpanel directly so the build doesn't pull a big native
 * module before we wire credentials. Replace the no-op implementation below
 * with `mixpanel-react-native` once a project token is provisioned.
 *
 * Event taxonomy follows packages/events (doc 03). For the mobile app the
 * minimum events to fire are:
 *  - app.opened
 *  - app.signed_in           { method: 'magic_link' | 'biometric' }
 *  - lead.viewed             { lead_id, source }
 *  - lead.action.call        { lead_id }   ← one-tap RevTry
 *  - lead.action.sms         { lead_id, template? }
 *  - lead.action.email       { lead_id, template? }
 *  - voice.command.recorded  { duration_ms, surface: 'funnel_detail' | ... }
 *  - voice.command.routed    { intent }
 *  - push.received           { kind }
 *  - push.opened             { kind }
 *  - widget.tapped           { widget }
 *
 * Each event MUST be non-PII at the property level — names and emails belong
 * in the CRM, not the analytics stream.
 */
import { useAuthStore } from "./auth";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

class Analytics {
  private enabled = true;
  private superProps: AnalyticsProps = {};

  identify(userId: string, props?: AnalyticsProps): void {
    if (!this.enabled) return;
    this.superProps = { ...this.superProps, userId };
    if (__DEV__) console.log("[analytics] identify", userId, props);
  }

  track(event: string, props: AnalyticsProps = {}): void {
    if (!this.enabled) return;
    const workspaceId = useAuthStore.getState().workspaceId ?? null;
    const payload = { ...this.superProps, workspaceId, ...props };
    if (__DEV__) console.log("[analytics]", event, payload);
    // TODO: replace with mixpanel.track(event, payload) once SDK wired.
  }

  reset(): void {
    this.superProps = {};
  }

  setOptOut(optOut: boolean): void {
    this.enabled = !optOut;
  }
}

export const analytics = new Analytics();
