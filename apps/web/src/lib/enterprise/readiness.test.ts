import { describe, expect, it } from "vitest";

import { buildEnterpriseReadinessSnapshot } from "./readiness";

describe("enterprise readiness snapshot", () => {
  it("reports explicit blockers when credentialed systems are not configured", () => {
    const snapshot = buildEnterpriseReadinessSnapshot({});

    expect(snapshot.ok).toBe(false);
    expect(snapshot.overall.blockerCount).toBeGreaterThan(0);
    expect(snapshot.areas.map((area) => area.id)).toEqual([
      "enterprise_identity",
      "signalwire_automation",
      "observability_dashboard",
      "admin_operations",
    ]);
    expect(snapshot.areas.find((area) => area.id === "signalwire_automation")?.blockers.join(" ")).toContain(
      "SignalWire",
    );
  });

  it("moves credential checks forward while keeping operational controls gated", () => {
    const snapshot = buildEnterpriseReadinessSnapshot({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GOOGLE_WORKSPACE_DOMAIN: "gofunnelai.com",
      ADMIN_WEBAUTHN_RP_ID: "gofunnelai.com",
      ADMIN_WEBAUTHN_ORIGIN: "https://gofunnelai.com",
      ADMIN_SESSION_SECRET: "session-secret",
      SIGNALWIRE_PROJECT_ID: "project",
      SIGNALWIRE_API_TOKEN: "token",
      SIGNALWIRE_SPACE_URL: "https://example.signalwire.com",
      SIGNALWIRE_FROM_NUMBER: "+15555550100",
      ADMIN_IMPERSONATION_SECRET: "impersonation-secret",
    });

    const identity = snapshot.areas.find((area) => area.id === "enterprise_identity");
    const signalwire = snapshot.areas.find((area) => area.id === "signalwire_automation");

    expect(snapshot.ok).toBe(false);
    expect(identity?.credentialChecks.every((check) => !check.required || check.present)).toBe(true);
    expect(identity?.state).toBe("needs_configuration");
    expect(identity?.blockers).toEqual(expect.arrayContaining(["Break-glass path documented"]));
    expect(signalwire?.score).toBeGreaterThan(70);
    expect(signalwire?.blockers).toEqual(expect.arrayContaining(["Webhook retry and DLQ replay"]));
    expect(snapshot.adminOperations.capabilities.some((capability) => capability.id === "impersonate")).toBe(true);
  });
});
