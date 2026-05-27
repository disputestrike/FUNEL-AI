/**
 * Template registry — every template has:
 *   - id (used in send() calls)
 *   - subject (default; caller can override)
 *   - render: (data) => Promise<{ html, text }>
 *
 * The registry is the source of truth for which templates exist.
 */

import { render as renderReact } from "@react-email/render";
import * as React from "react";

// Auth
import { VerifyEmail } from "./auth/verify-email.js";
import { PasswordReset } from "./auth/password-reset.js";
import { PasswordChanged } from "./auth/password-changed.js";
import { MfaEnabled } from "./auth/mfa-enabled.js";
import { MfaDisabled } from "./auth/mfa-disabled.js";
import { NewDeviceLogin } from "./auth/new-device-login.js";
import { EmailChanged } from "./auth/email-changed.js";
import { AccountDeletionConfirmed } from "./auth/account-deletion-confirmed.js";

// Workspace
import { WorkspaceInvitation } from "./workspace/invitation.js";
import { WorkspaceInvitationAccepted } from "./workspace/invitation-accepted.js";
import { WorkspaceInvitationExpired } from "./workspace/invitation-expired.js";
import { WorkspaceRoleChanged } from "./workspace/role-changed.js";
import { WorkspaceOwnershipTransferRequested } from "./workspace/ownership-transfer-requested.js";
import { WorkspaceOwnershipTransferred } from "./workspace/ownership-transferred.js";
import { WorkspaceMemberRemoved } from "./workspace/member-removed.js";

// Onboarding
import { OnboardingWelcome } from "./onboarding/welcome.js";
import { OnboardingSetupIncomplete } from "./onboarding/setup-incomplete-d2.js";
import { OnboardingFirstFunnelReminder } from "./onboarding/first-funnel-reminder-d5.js";
import { OnboardingFirstLeadReminder } from "./onboarding/first-lead-reminder-d7.js";
import { OnboardingInactivity } from "./onboarding/inactivity-d14.js";
import { OnboardingCommunityInvite } from "./onboarding/community-invite-d4.js";
import { OnboardingChallengeInvite } from "./onboarding/challenge-invite-d7.js";

// Funnels
import { FunnelPublished } from "./funnels/funnel-published.js";
import { FirstLeadCaptured } from "./funnels/first-lead-captured.js";
import { MilestoneHit } from "./funnels/milestone-hit.js";
import { FunnelPaused } from "./funnels/funnel-paused.js";
import { FunnelArchived } from "./funnels/funnel-archived.js";
import { AbWinnerPromoted } from "./funnels/ab-winner-promoted.js";
import { PerformanceSummaryWeekly } from "./funnels/performance-summary-weekly.js";

// Billing
import { TrialStarted } from "./billing/trial-started.js";
import { TrialEndingT3 } from "./billing/trial-ending-t3.js";
import { TrialEndingT1 } from "./billing/trial-ending-t1.js";
import { UpgradeConfirmed } from "./billing/upgrade-confirmed.js";
import { DowngradeConfirmed } from "./billing/downgrade-confirmed.js";
import { Receipt } from "./billing/receipt.js";
import { PaymentFailed1 } from "./billing/payment-failed-1.js";
import { PaymentFailed2 } from "./billing/payment-failed-2.js";
import { PaymentFailed3 } from "./billing/payment-failed-3.js";
import { CardExpiringT30 } from "./billing/card-expiring-t30.js";
import { CardExpiringT7 } from "./billing/card-expiring-t7.js";
import { AccountPastDue } from "./billing/account-past-due.js";
import { AccountSuspended } from "./billing/suspended.js";
import { AccountRestored } from "./billing/restored.js";
import { SubscriptionCanceled } from "./billing/canceled.js";
import { RefundIssued } from "./billing/refund-issued.js";

// Security
import { ApiKeyCreated } from "./security/api-key-created.js";
import { ApiKeyRevoked } from "./security/api-key-revoked.js";
import { WebhookEndpointChanged } from "./security/webhook-endpoint-changed.js";
import { SuspiciousActivityAlert } from "./security/suspicious-activity-alert.js";

// Notifications
import { NewLead } from "./notifications/new-lead.js";
import { DailyDigest } from "./notifications/daily-digest.js";
import { WeeklyPerformanceSummary } from "./notifications/weekly-performance-summary.js";

export interface TemplateRenderResult {
  html: string;
  text: string;
  subject: string;
}

export interface TemplateDef {
  id: string;
  default_subject: (data: Record<string, unknown>) => string;
  render: (data: Record<string, unknown>) => Promise<TemplateRenderResult>;
}

function build(id: string, defaultSubject: (d: Record<string, unknown>) => string, Component: React.ComponentType<any>): TemplateDef {
  return {
    id,
    default_subject: defaultSubject,
    render: async (data) => {
      const element = React.createElement(Component, data);
      const html = await renderReact(element);
      const text = await renderReact(element, { plainText: true });
      return { html, text, subject: defaultSubject(data) };
    },
  };
}

export const TEMPLATES: Record<string, TemplateDef> = {
  // auth (8)
  "verify-email": build("verify-email", () => "Verify your GoFunnelAI email", VerifyEmail),
  "password-reset": build("password-reset", () => "Password reset link inside", PasswordReset),
  "password-changed": build("password-changed", () => "Your password was just changed", PasswordChanged),
  "mfa-enabled": build("mfa-enabled", () => "2FA is now on. Nice.", MfaEnabled),
  "mfa-disabled": build("mfa-disabled", () => "2FA was turned off", MfaDisabled),
  "new-device-login": build("new-device-login", (d) => `New login from ${(d.location as string) ?? "an unknown device"}`, NewDeviceLogin),
  "email-changed": build("email-changed", () => "Your account email was changed", EmailChanged),
  "account-deletion-confirmed": build("account-deletion-confirmed", () => "Your account was archived", AccountDeletionConfirmed),

  // workspace (7)
  "invitation": build("invitation", (d) => `You're invited to ${(d.workspace_name as string) ?? "a workspace"} on GoFunnelAI`, WorkspaceInvitation),
  "invitation-accepted": build("invitation-accepted", (d) => `${(d.member_name as string) ?? "A teammate"} joined your workspace`, WorkspaceInvitationAccepted),
  "invitation-expired": build("invitation-expired", () => "Your workspace invite has expired", WorkspaceInvitationExpired),
  "role-changed": build("role-changed", () => "Your role on GoFunnelAI changed", WorkspaceRoleChanged),
  "ownership-transfer-requested": build("ownership-transfer-requested", () => "Confirm ownership transfer", WorkspaceOwnershipTransferRequested),
  "ownership-transferred": build("ownership-transferred", () => "Workspace ownership transferred", WorkspaceOwnershipTransferred),
  "member-removed": build("member-removed", () => "You were removed from a workspace", WorkspaceMemberRemoved),

  // onboarding (7)
  "welcome": build("welcome", () => "Welcome to GoFunnelAI", OnboardingWelcome),
  "setup-incomplete-d2": build("setup-incomplete-d2", () => "Two minutes to finish setup", OnboardingSetupIncomplete),
  "first-funnel-reminder-d5": build("first-funnel-reminder-d5", () => "Let's build your first funnel", OnboardingFirstFunnelReminder),
  "first-lead-reminder-d7": build("first-lead-reminder-d7", () => "Still waiting on lead #1?", OnboardingFirstLeadReminder),
  "inactivity-d14": build("inactivity-d14", () => "Anything we can help with?", OnboardingInactivity),
  "community-invite-d4": build("community-invite-d4", () => "Come hang out with other builders", OnboardingCommunityInvite),
  "challenge-invite-d7": build("challenge-invite-d7", () => "Try the 7-Day Funnel Challenge", OnboardingChallengeInvite),

  // funnels (7)
  "funnel-published": build("funnel-published", (d) => `${(d.funnel_name as string) ?? "Your funnel"} is live`, FunnelPublished),
  "first-lead-captured": build("first-lead-captured", () => "You got your first lead", FirstLeadCaptured),
  "milestone-hit": build("milestone-hit", (d) => `You crossed $${(d.amount_usd as number) ?? 0}`, MilestoneHit),
  "funnel-paused": build("funnel-paused", () => "Your funnel was paused for review", FunnelPaused),
  "funnel-archived": build("funnel-archived", () => "Your funnel was archived", FunnelArchived),
  "ab-winner-promoted": build("ab-winner-promoted", () => "A/B winner promoted", AbWinnerPromoted),
  "performance-summary-weekly": build("performance-summary-weekly", () => "Your weekly performance summary", PerformanceSummaryWeekly),

  // billing (16)
  "trial-started": build("trial-started", () => "Your trial is live", TrialStarted),
  "trial-ending-t3": build("trial-ending-t3", () => "3 days left in your trial", TrialEndingT3),
  "trial-ending-t1": build("trial-ending-t1", () => "Your trial ends tomorrow", TrialEndingT1),
  "upgrade-confirmed": build("upgrade-confirmed", () => "Plan upgraded — welcome to more", UpgradeConfirmed),
  "downgrade-confirmed": build("downgrade-confirmed", () => "Plan change confirmed", DowngradeConfirmed),
  "receipt": build("receipt", (d) => `Receipt for $${(d.amount_usd as number) ?? 0} — ${(d.plan as string) ?? ""}`, Receipt),
  "payment-failed-1": build("payment-failed-1", () => "Payment failed — quick fix", PaymentFailed1),
  "payment-failed-2": build("payment-failed-2", () => "Second payment attempt failed", PaymentFailed2),
  "payment-failed-3": build("payment-failed-3", () => "Final payment attempt failed", PaymentFailed3),
  "card-expiring-t30": build("card-expiring-t30", () => "Your card expires in 30 days", CardExpiringT30),
  "card-expiring-t7": build("card-expiring-t7", () => "Your card expires in 7 days", CardExpiringT7),
  "account-past-due": build("account-past-due", () => "Your account is past due", AccountPastDue),
  "suspended": build("suspended", () => "Your account was suspended", AccountSuspended),
  "restored": build("restored", () => "Your account is restored", AccountRestored),
  "canceled": build("canceled", () => "Subscription cancelled", SubscriptionCanceled),
  "refund-issued": build("refund-issued", (d) => `Refund processed — $${(d.amount_usd as number) ?? 0}`, RefundIssued),

  // security (4)
  "api-key-created": build("api-key-created", () => "An API key was created on your workspace", ApiKeyCreated),
  "api-key-revoked": build("api-key-revoked", () => "An API key was revoked", ApiKeyRevoked),
  "webhook-endpoint-changed": build("webhook-endpoint-changed", () => "A webhook endpoint changed", WebhookEndpointChanged),
  "suspicious-activity-alert": build("suspicious-activity-alert", () => "Suspicious activity on your account", SuspiciousActivityAlert),

  // notifications (3)
  "new-lead": build("new-lead", (d) => `New lead — ${(d.lead_name as string) ?? "see details"}`, NewLead),
  "daily-digest": build("daily-digest", () => "Your daily GoFunnelAI digest", DailyDigest),
  "weekly-performance-summary": build("weekly-performance-summary", () => "Your weekly performance summary", WeeklyPerformanceSummary),
};

export function listTemplateIds(): string[] {
  return Object.keys(TEMPLATES);
}
