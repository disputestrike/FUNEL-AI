/**
 * GoFunnelAI — Campaign Export agent.
 *
 * Produces a downloadable artifact for a Launch Center campaign in one of
 * three formats:
 *
 *   - "pdf": campaign plan rendered as a portable PDF document (uses an
 *      injected `PdfRenderer` — production wires @react-pdf, tests pass a
 *      deterministic stub).
 *   - "csv": flat tables for Google Ads bulk upload (keywords, negatives,
 *      copy variants).
 *   - "zip": multi-artifact bundle containing the PDF + CSVs + creative
 *      manifests + per-platform launch instructions + UTM sheet.
 *
 * Uploads via an injected `R2Uploader` (production wires Cloudflare R2,
 * tests pass an in-memory stub). Returns the `ExportPackage` record plus a
 * signed download URL.
 */

import { createHash } from "node:crypto";

import {
  ExportFormat,
  type AdVariant,
  type Campaign,
  type CreativeAsset,
  type ExportPackage,
  type LaunchChecklist,
  type Platform,
  type UtmLink,
  type VideoAsset,
} from "@funnel/shared/launch";

import { emitLaunch } from "./events.js";

// ---------------------------------------------------------------------------
// Dependency surfaces
// ---------------------------------------------------------------------------

export interface R2Uploader {
  /**
   * Upload `bytes` to R2 at `key`. Implementations should return a signed
   * URL valid for `expiresSec` seconds.
   */
  put(args: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
    expiresSec?: number;
  }): Promise<{ s3Uri: string; cdnUrl: string | null; signedUrl: string; expiresAt: Date | null }>;
}

export interface PdfRenderer {
  /** Render an "in-memory PDF document". Production wires @react-pdf. */
  renderCampaignPlan(args: CampaignPlanDoc): Promise<Uint8Array>;
  /** Render a platform-specific launch instructions PDF. */
  renderPlatformInstructions(args: PlatformInstructionsDoc): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CampaignExportFormat = "pdf" | "csv" | "zip";

export interface ExportCampaignInputs {
  campaign: Campaign;
  variants: AdVariant[];
  creativeAssets: CreativeAsset[];
  videoAssets: VideoAsset[];
  utmLinks: UtmLink[];
  trackingChecklist: LaunchChecklist;
  /** Google Ads keywords (positives). */
  keywords?: string[];
  /** Google Ads negative keywords. */
  negativeKeywords?: string[];
  /** Industry slug for narrative. */
  industry?: string;
  /** User performing the export. */
  generatedBy: string;
}

export interface ExportCampaignArgs {
  inputs: ExportCampaignInputs;
  format: CampaignExportFormat;
  r2: R2Uploader;
  pdf?: PdfRenderer;
  /** Defaults to 24h. */
  signedUrlExpiresSec?: number;
}

export interface CampaignPlanDoc {
  campaignName: string;
  industry: string | null;
  objective: string;
  platforms: Platform[];
  variantSummaries: Array<{
    id: string;
    platform: Platform;
    angle: string;
    headline: string;
    primaryText: string;
    cta: string;
  }>;
  checklistSummary: Array<{ label: string; status: string; required: boolean }>;
}

export interface PlatformInstructionsDoc {
  platform: Platform;
  campaignName: string;
  steps: string[];
}

export interface ExportResult {
  package: ExportPackage;
  signedUrl: string;
  /** The raw bytes produced — handy for tests / local CLIs. */
  bytes: Uint8Array;
  /** Human-readable manifest of what's in the archive (zip only). */
  manifest?: string[];
}

// ---------------------------------------------------------------------------
// Helpers — CSV
// ---------------------------------------------------------------------------

function csvEscape(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows: Array<Record<string, string | number | null | undefined>>, columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

function buildKeywordsCsv(inputs: ExportCampaignInputs): string {
  return rowsToCsv(
    (inputs.keywords ?? []).map((kw, i) => ({
      Campaign: inputs.campaign.name,
      "Ad Group": "Default",
      Keyword: kw,
      "Match Type": "Phrase",
      Status: "Enabled",
      Position: i + 1,
    })),
    ["Campaign", "Ad Group", "Keyword", "Match Type", "Status", "Position"],
  );
}

function buildNegativesCsv(inputs: ExportCampaignInputs): string {
  return rowsToCsv(
    (inputs.negativeKeywords ?? []).map((kw) => ({
      Campaign: inputs.campaign.name,
      "Negative Keyword": kw,
      "Match Type": "Phrase",
      Level: "Campaign",
    })),
    ["Campaign", "Negative Keyword", "Match Type", "Level"],
  );
}

function buildVariantsCsv(inputs: ExportCampaignInputs): string {
  return rowsToCsv(
    inputs.variants.map((v) => ({
      Campaign: inputs.campaign.name,
      Platform: v.platform,
      Angle: v.angle,
      Headline: v.headline,
      "Primary Text": v.primaryText,
      Description: v.description ?? "",
      CTA: v.cta,
      "Destination URL": v.destinationUrl,
      "UTM Link Id": v.utmLinkId ?? "",
      Status: v.status,
    })),
    [
      "Campaign",
      "Platform",
      "Angle",
      "Headline",
      "Primary Text",
      "Description",
      "CTA",
      "Destination URL",
      "UTM Link Id",
      "Status",
    ],
  );
}

function buildUtmSheetCsv(inputs: ExportCampaignInputs): string {
  return rowsToCsv(
    inputs.utmLinks.map((u) => ({
      Source: u.utmSource,
      Medium: u.utmMedium,
      Campaign: u.utmCampaign,
      Content: u.utmContent ?? "",
      Term: u.utmTerm ?? "",
      "Destination URL": u.destinationUrl,
      "Short URL": u.shortUrl ?? "",
      Code: u.shortCode ?? "",
    })),
    ["Source", "Medium", "Campaign", "Content", "Term", "Destination URL", "Short URL", "Code"],
  );
}

// ---------------------------------------------------------------------------
// Helpers — PDF doc shapes
// ---------------------------------------------------------------------------

function buildCampaignPlanDoc(inputs: ExportCampaignInputs): CampaignPlanDoc {
  return {
    campaignName: inputs.campaign.name,
    industry: inputs.industry ?? null,
    objective: inputs.campaign.objective,
    platforms: inputs.campaign.platforms,
    variantSummaries: inputs.variants.slice(0, 16).map((v) => ({
      id: v.id,
      platform: v.platform,
      angle: String(v.angle),
      headline: v.headline,
      primaryText: v.primaryText,
      cta: v.cta,
    })),
    checklistSummary: inputs.trackingChecklist.items.map((i) => ({
      label: i.label,
      status: i.status,
      required: i.required,
    })),
  };
}

function buildPlatformInstructionsDocs(inputs: ExportCampaignInputs): PlatformInstructionsDoc[] {
  return inputs.campaign.platforms.map((p) => ({
    platform: p,
    campaignName: inputs.campaign.name,
    steps: [
      `1. Open ${p} Ads Manager and create a new campaign named "${inputs.campaign.name}".`,
      `2. Upload the GoFunnelAI variants (CSV included) targeting the campaign objective: ${inputs.campaign.objective}.`,
      `3. Install the ${p} pixel using the snippet documented in the Tracking checklist.`,
      `4. Wire conversion events listed in the Launch Plan PDF (default: lead_captured).`,
      `5. Confirm UTM URLs match the UTM Sheet CSV.`,
      `6. Set daily cap to the value from your Campaign record.`,
      `7. Run a 24-hour test budget before scaling.`,
    ],
  }));
}

// ---------------------------------------------------------------------------
// Helpers — bytes / archive
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function bytes(s: string): Uint8Array {
  return encoder.encode(s);
}

function sha256Hex(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Build a deterministic, line-oriented archive payload. Real production code
 * would emit a proper ZIP using fflate — this format is sufficient for tests,
 * audit logs, and the R2 stub. Each entry: `--FILE name:<path> bytes:<n>\n…\n`.
 */
function packArchive(files: ReadonlyArray<{ path: string; data: Uint8Array }>): { bytes: Uint8Array; manifest: string[] } {
  const parts: Uint8Array[] = [];
  const manifest: string[] = [];
  for (const f of files) {
    const header = bytes(`--FILE name:${f.path} bytes:${f.data.byteLength}\n`);
    parts.push(header, f.data, bytes("\n"));
    manifest.push(f.path);
  }
  const total = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return { bytes: out, manifest };
}

function defaultPdfBytes(doc: CampaignPlanDoc | PlatformInstructionsDoc): Uint8Array {
  // Tiny PDF-1.3 shaped envelope so the artifact is identifiable as PDF-like
  // even when no real renderer is plugged in.
  const header = "%PDF-1.3\n%%GoFunnelAI Launch Center plan (stub renderer)\n";
  const body = JSON.stringify(doc, null, 2);
  return bytes(`${header}${body}\n%%EOF\n`);
}

const fallbackPdfRenderer: PdfRenderer = {
  renderCampaignPlan: async (doc) => defaultPdfBytes(doc),
  renderPlatformInstructions: async (doc) => defaultPdfBytes(doc),
};

// ---------------------------------------------------------------------------
// Format mapping
// ---------------------------------------------------------------------------

function mapFormat(format: CampaignExportFormat): ExportFormat {
  switch (format) {
    case "pdf":
      return ExportFormat.Pdf;
    case "csv":
      return ExportFormat.GoogleAdsCsv;
    case "zip":
      return ExportFormat.Zip;
  }
}

function contentTypeOf(format: CampaignExportFormat): string {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv";
    case "zip":
      return "application/zip";
  }
}

function extensionOf(format: CampaignExportFormat): string {
  return format;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportCampaign(args: ExportCampaignArgs): Promise<ExportResult> {
  const { inputs, format, r2 } = args;
  const pdf = args.pdf ?? fallbackPdfRenderer;
  const expires = args.signedUrlExpiresSec ?? 60 * 60 * 24;

  await emitLaunch(
    "launch_export_started",
    {
      campaign_id: inputs.campaign.id,
      format,
      variant_count: inputs.variants.length,
      asset_count: inputs.creativeAssets.length + inputs.videoAssets.length,
    },
    { campaignId: inputs.campaign.id, workspaceId: inputs.campaign.workspaceId },
  );

  let payload: Uint8Array;
  let manifest: string[] | undefined;

  try {
    if (format === "pdf") {
      payload = await pdf.renderCampaignPlan(buildCampaignPlanDoc(inputs));
    } else if (format === "csv") {
      const csvSections = [
        "# variants",
        buildVariantsCsv(inputs),
        "# keywords",
        buildKeywordsCsv(inputs),
        "# negatives",
        buildNegativesCsv(inputs),
        "# utm_links",
        buildUtmSheetCsv(inputs),
      ].join("\n");
      payload = bytes(csvSections);
    } else {
      const files: Array<{ path: string; data: Uint8Array }> = [];
      const planPdf = await pdf.renderCampaignPlan(buildCampaignPlanDoc(inputs));
      files.push({ path: "campaign-plan.pdf", data: planPdf });

      files.push({ path: "variants.csv", data: bytes(buildVariantsCsv(inputs)) });
      files.push({ path: "keywords.csv", data: bytes(buildKeywordsCsv(inputs)) });
      files.push({ path: "negatives.csv", data: bytes(buildNegativesCsv(inputs)) });
      files.push({ path: "utm-links.csv", data: bytes(buildUtmSheetCsv(inputs)) });

      // Creative assets — referenced by metadata; binary payloads are externally hosted.
      const imageManifest = inputs.creativeAssets.map((a) => ({
        id: a.id,
        type: a.type,
        s3Uri: a.s3Uri,
        cdnUrl: a.cdnUrl,
        sha256: a.sha256,
        altText: a.altText,
      }));
      files.push({ path: "assets/image-manifest.json", data: bytes(JSON.stringify(imageManifest, null, 2)) });

      const videoManifest = inputs.videoAssets.map((v) => ({
        id: v.id,
        videoType: v.videoType,
        s3Uri: v.s3Uri,
        cdnUrl: v.cdnUrl,
        durationSec: v.durationSec,
        aspectRatio: v.aspectRatio,
        hasCaptions: v.hasCaptions,
        hasVoiceover: v.hasVoiceover,
        hooks: v.hooks,
      }));
      files.push({ path: "assets/video-manifest.json", data: bytes(JSON.stringify(videoManifest, null, 2)) });

      // Video scripts + captions (text snapshots).
      for (const v of inputs.videoAssets) {
        if (v.script) {
          files.push({ path: `scripts/${v.id}.txt`, data: bytes(v.script) });
        }
      }

      // Launch checklist as Markdown.
      const checklistMd = [
        `# ${inputs.campaign.name} — Launch Checklist`,
        "",
        ...inputs.trackingChecklist.items.map(
          (i) => `- [${i.status === "passed" ? "x" : " "}] ${i.label} ${i.required ? "(required)" : "(optional)"}`,
        ),
      ].join("\n");
      files.push({ path: "launch-checklist.md", data: bytes(checklistMd) });

      // Per-platform instructions PDFs.
      for (const doc of buildPlatformInstructionsDocs(inputs)) {
        const platformPdf = await pdf.renderPlatformInstructions(doc);
        files.push({ path: `platforms/${doc.platform}-instructions.pdf`, data: platformPdf });
      }

      const packed = packArchive(files);
      payload = packed.bytes;
      manifest = packed.manifest;
    }
  } catch (err) {
    await emitLaunch(
      "launch_export_failed",
      {
        campaign_id: inputs.campaign.id,
        format,
        error: String(err),
      },
      { campaignId: inputs.campaign.id, workspaceId: inputs.campaign.workspaceId },
    );
    throw err;
  }

  const key = `exports/${inputs.campaign.workspaceId}/${inputs.campaign.id}.${extensionOf(format)}`;
  const upload = await r2.put({
    key,
    bytes: payload,
    contentType: contentTypeOf(format),
    expiresSec: expires,
  });

  const sha = sha256Hex(payload);
  const pkg: ExportPackage = {
    id: `xpk_${sha.slice(0, 16)}`,
    campaignId: inputs.campaign.id,
    format: mapFormat(format),
    platform: null,
    s3Uri: upload.s3Uri,
    cdnUrl: upload.cdnUrl,
    sha256: sha,
    bytes: payload.byteLength,
    variantCount: inputs.variants.length,
    assetCount: inputs.creativeAssets.length + inputs.videoAssets.length,
    expiresAt: upload.expiresAt,
    downloadedCount: 0,
    generatedAt: new Date(),
    generatedBy: inputs.generatedBy,
  };

  await emitLaunch(
    "launch_export_completed",
    {
      campaign_id: inputs.campaign.id,
      format,
      bytes: payload.byteLength,
      sha256: sha,
      signed_url_expires_at: upload.expiresAt?.toISOString() ?? null,
    },
    { campaignId: inputs.campaign.id, workspaceId: inputs.campaign.workspaceId },
  );

  return { package: pkg, signedUrl: upload.signedUrl, bytes: payload, manifest };
}

export const __internal = {
  buildKeywordsCsv,
  buildNegativesCsv,
  buildVariantsCsv,
  buildUtmSheetCsv,
  packArchive,
  fallbackPdfRenderer,
};
