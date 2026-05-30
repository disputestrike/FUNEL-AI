import { describe, expect, it } from "vitest";

import { buildEnterpriseReadinessReport, campaignStageSummaries } from "./evaluate";

describe("product readiness evaluator", () => {
  it("marks a fully supplied enterprise launch as ready", () => {
    const report = buildEnterpriseReadinessReport({
      companyName: "Northstar Solar",
      industry: "Residential solar",
      teamSize: "enterprise",
      crm: "salesforce",
      launchWindow: "this_quarter",
      channels: ["web", "email", "sms", "voice"],
      hasBrandAssets: true,
      hasComplianceReview: true,
      hasTestPlan: true,
      needsDataResidency: false,
    });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("ready");
    expect(report.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.priorityLanes).toEqual([]);
    expect(report.assetStoragePlan.some((item) => item.includes("manifest.json"))).toBe(true);
    expect(report.crmPlan.join(" ")).toContain("Salesforce");
  });

  it("surfaces blocked lanes when CRM, compliance, brand, and tests are missing", () => {
    const report = buildEnterpriseReadinessReport({
      companyName: "Fast Growth Clinic",
      industry: "Healthcare",
      teamSize: "growth_team",
      crm: "none",
      launchWindow: "this_week",
      channels: ["web", "sms", "voice"],
      hasBrandAssets: false,
      hasComplianceReview: false,
      hasTestPlan: false,
      needsDataResidency: false,
    });

    expect(report.status).not.toBe("ready");
    expect(report.priorityLanes).toEqual(
      expect.arrayContaining(["CRM Readiness", "Testing Depth", "Product Completeness"]),
    );
    expect(report.crmPlan.join(" ")).toContain("No CRM selected");
    expect(report.testingPlan.join(" ")).toContain("fallback");
  });

  it("does not report the overall launch as ready while any required lane needs input", () => {
    const report = buildEnterpriseReadinessReport();

    expect(report.overallScore).toBeGreaterThanOrEqual(80);
    expect(report.status).toBe("needs_input");
    expect(report.priorityLanes).toEqual(
      expect.arrayContaining([
        "AI Orchestration Readiness",
        "Asset Generation And Storage Plan",
        "Testing Depth",
      ]),
    );
  });

  it("maps campaign stages to human-readable readiness gates", () => {
    const stages = campaignStageSummaries();

    expect(stages).toHaveLength(4);
    expect(stages[0]?.gates).toEqual(
      expect.arrayContaining(["AI Orchestration Readiness", "Product Completeness"]),
    );
  });
});
