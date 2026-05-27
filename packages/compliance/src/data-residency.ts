/**
 * Data residency enforcement.
 *
 * Workspaces are pinned to a region at create time (or migrated under
 * customer request with audit). All storage destinations resolve through
 * this module:
 *
 *  - Postgres read/write goes through region-specific connection pool.
 *  - R2/S3 PUT / GET targets the right bucket.
 *  - Search indexes (Algolia, Typesense) targeted to region.
 *  - LLM providers — call the regional endpoint where available
 *    (Anthropic eu-* / Bedrock per-region / Azure OpenAI per-region).
 *
 * Source: 05b Privacy §6.3, 07a §11 (KYC stack regional), engineering ops.
 */

import type { Jurisdiction } from "./regulated-verticals.js";

export type DataRegion = "us-east-1" | "us-west-2" | "eu-west-1" | "eu-central-1" | "ap-south-1" | "ap-southeast-2" | "sa-east-1";

export interface RegionConfig {
  region: DataRegion;
  /** R2 bucket name for this region. */
  r2Bucket: string;
  /** S3 backup bucket. */
  s3Bucket: string;
  /** Postgres pool URL (env-var name; do not hardcode secrets). */
  pgUrlEnvVar: string;
  /** LLM endpoint preferences. */
  llmEndpoints: {
    anthropic?: string;
    openai?: string;
    bedrock?: string;
  };
  /** Acceptable jurisdictions for data subjects in this region. */
  jurisdictions: Jurisdiction[];
}

const REGIONS: Record<DataRegion, RegionConfig> = {
  "us-east-1": {
    region: "us-east-1",
    r2Bucket: "funnel-us-east",
    s3Bucket: "funnel-backup-us-east",
    pgUrlEnvVar: "PG_URL_US_EAST",
    llmEndpoints: { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", bedrock: "us-east-1" },
    jurisdictions: ["US", "US-CA", "US-NY", "US-TX", "US-FL"],
  },
  "us-west-2": {
    region: "us-west-2",
    r2Bucket: "funnel-us-west",
    s3Bucket: "funnel-backup-us-west",
    pgUrlEnvVar: "PG_URL_US_WEST",
    llmEndpoints: { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", bedrock: "us-west-2" },
    jurisdictions: ["US", "US-CA", "US-NY", "US-TX", "US-FL"],
  },
  "eu-west-1": {
    region: "eu-west-1",
    r2Bucket: "funnel-eu-west",
    s3Bucket: "funnel-backup-eu-west",
    pgUrlEnvVar: "PG_URL_EU_WEST",
    llmEndpoints: { anthropic: "https://api.eu.anthropic.com", openai: "https://eu.api.openai.com", bedrock: "eu-west-1" },
    jurisdictions: ["EU", "UK"],
  },
  "eu-central-1": {
    region: "eu-central-1",
    r2Bucket: "funnel-eu-central",
    s3Bucket: "funnel-backup-eu-central",
    pgUrlEnvVar: "PG_URL_EU_CENTRAL",
    llmEndpoints: { anthropic: "https://api.eu.anthropic.com", openai: "https://eu.api.openai.com", bedrock: "eu-central-1" },
    jurisdictions: ["EU"],
  },
  "ap-south-1": {
    region: "ap-south-1",
    r2Bucket: "funnel-ap-south",
    s3Bucket: "funnel-backup-ap-south",
    pgUrlEnvVar: "PG_URL_IN",
    llmEndpoints: { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", bedrock: "ap-south-1" },
    jurisdictions: ["IN"],
  },
  "ap-southeast-2": {
    region: "ap-southeast-2",
    r2Bucket: "funnel-ap-se",
    s3Bucket: "funnel-backup-ap-se",
    pgUrlEnvVar: "PG_URL_AU",
    llmEndpoints: { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", bedrock: "ap-southeast-2" },
    jurisdictions: ["AU"],
  },
  "sa-east-1": {
    region: "sa-east-1",
    r2Bucket: "funnel-sa-east",
    s3Bucket: "funnel-backup-sa-east",
    pgUrlEnvVar: "PG_URL_BR",
    llmEndpoints: { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", bedrock: "sa-east-1" },
    jurisdictions: ["BR"],
  },
};

export interface WorkspaceResidency {
  workspaceId: string;
  region: DataRegion;
  /** Lock prevents region migration without explicit signed change-control. */
  locked: boolean;
  pinnedAt: string;
  pinnedReason: "user_country" | "compliance_eu" | "compliance_in" | "compliance_br" | "customer_choice" | "default";
}

/** Choose the right region given a country code, falling back to us-east-1. */
export function pickRegionFor(countryCode: string | null | undefined): DataRegion {
  if (!countryCode) return "us-east-1";
  const c = countryCode.toUpperCase();
  if (c === "US" || c === "CA" || c === "MX") return "us-east-1";
  if (["GB", "IE", "DE", "FR", "NL", "ES", "IT", "PT", "BE", "PL", "SE", "DK", "FI", "NO", "AT", "CH"].includes(c))
    return c === "GB" || c === "IE" || c === "PT" || c === "ES" ? "eu-west-1" : "eu-central-1";
  if (c === "IN") return "ap-south-1";
  if (c === "AU" || c === "NZ") return "ap-southeast-2";
  if (c === "BR" || c === "AR" || c === "CL" || c === "CO") return "sa-east-1";
  return "us-east-1";
}

export function configFor(region: DataRegion): RegionConfig {
  return REGIONS[region];
}

export interface ResidencyResolver {
  /** Find the workspace's pinned region. */
  resolve(workspaceId: string): Promise<WorkspaceResidency | null>;
}

/**
 * Enforcement guard — call before any storage read/write to make sure the
 * request is routed to the workspace's pinned region. Throws otherwise.
 */
export class ResidencyEnforcer {
  constructor(private readonly resolver: ResidencyResolver) {}

  async assertRegion(workspaceId: string, requestedRegion: DataRegion): Promise<void> {
    const r = await this.resolver.resolve(workspaceId);
    if (!r) return; // legacy workspace, fall through with warning
    if (r.region !== requestedRegion) {
      throw new Error(
        `Data residency violation: workspace ${workspaceId} pinned to ${r.region}, request targeted ${requestedRegion}.`,
      );
    }
  }

  async resolveStorage(workspaceId: string): Promise<RegionConfig> {
    const r = await this.resolver.resolve(workspaceId);
    return REGIONS[r?.region ?? "us-east-1"];
  }
}

export class InMemoryResidencyResolver implements ResidencyResolver {
  private readonly byWs = new Map<string, WorkspaceResidency>();
  pin(input: Omit<WorkspaceResidency, "pinnedAt"> & { pinnedAt?: string }): void {
    this.byWs.set(input.workspaceId, { ...input, pinnedAt: input.pinnedAt ?? new Date().toISOString() });
  }
  async resolve(workspaceId: string): Promise<WorkspaceResidency | null> {
    return this.byWs.get(workspaceId) ?? null;
  }
}
