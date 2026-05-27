/**
 * Template loader.
 *
 * Reads filled-in KB pack templates from disk (markdown matching doc 02a),
 * validates them against the schema, and converts them into `IndustryPack`
 * objects ready for `savePack`.
 *
 * Filename convention:
 *
 *     src/packs/<industry>/<geo>-<language>.md
 *
 * e.g. `src/packs/solar/us-en.md`, `src/packs/med-spa/ca-en.md`.
 *
 * Parsing strategy:
 *   - Strip the YAML-style front-matter blockquote and the doc preamble.
 *   - Find every `## N. <Section Name>` heading and read content until the
 *     next `## ` heading.
 *   - Map heading number → canonical section id using
 *     `SECTION_HEADING_NUMBERS` from `types.ts`.
 *   - Parse the `## 24. Pack metadata` YAML block to populate metadata.
 *
 * Tolerant of:
 *   - Heading prefix variations ("## 1. Market overview" vs "## 1 — Market overview").
 *   - Trailing whitespace, BOM.
 *   - Missing sections marked `N/A — ...` (kept verbatim).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  IndustryPackSchema,
  KB_SECTIONS,
  SECTION_HEADING_NUMBERS,
  type IndustryPack,
  type IndustryPackMetadata,
  type KBSection,
} from "./types.js";

interface ParsedHeading {
  number: number;
  title: string;
  start: number;
  end: number;
}

const HEADING_RE = /^##\s+(\d+)[.\s—-]+([^\n]+)$/gm;

function parseHeadings(md: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  let match: RegExpExecArray | null;
  HEADING_RE.lastIndex = 0;
  while ((match = HEADING_RE.exec(md)) !== null) {
    const number = Number(match[1]);
    const title = (match[2] ?? "").trim();
    if (!Number.isFinite(number)) continue;
    headings.push({ number, title, start: match.index, end: match.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    const next = headings[i + 1];
    h.end = next ? next.start : md.length;
  }
  return headings;
}

function sectionForHeadingNumber(n: number): KBSection | null {
  for (const s of KB_SECTIONS) {
    if (SECTION_HEADING_NUMBERS[s] === n) return s;
  }
  return null;
}

function parseMetadataBlock(raw: string): Partial<IndustryPackMetadata> {
  const yamlBlock = /```ya?ml\s*([\s\S]*?)```/i.exec(raw);
  const body = yamlBlock ? yamlBlock[1] : raw;
  if (!body) return {};
  const out: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    const val = m[2]!.replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out as Partial<IndustryPackMetadata>;
}

/**
 * Parse a markdown KB pack into an IndustryPack.
 *
 * `industry`, `geo`, `language` are not in the markdown body — caller passes
 * them in (typically derived from the file path).
 */
export function parsePackMarkdown(
  md: string,
  args: { industry: string; geo: string; language: string; source_url?: string },
): IndustryPack {
  const cleaned = md.replace(/^﻿/, "");
  const headings = parseHeadings(cleaned);

  // Build empty section map.
  const sections: Record<KBSection, string> = {} as Record<KBSection, string>;
  for (const s of KB_SECTIONS) sections[s] = "";

  for (const h of headings) {
    const section = sectionForHeadingNumber(h.number);
    if (!section) continue;
    // Body is from after the heading line to the next heading.
    const body = cleaned.slice(h.start, h.end);
    // Drop the heading line itself.
    const firstNewline = body.indexOf("\n");
    sections[section] = firstNewline === -1 ? "" : body.slice(firstNewline + 1).trim();
  }

  // Metadata pulled from §24 plus inferred defaults.
  const metaRaw = parseMetadataBlock(sections.pack_metadata);
  const metadata: IndustryPackMetadata = {
    pack_id: metaRaw.pack_id ?? `${args.industry}-${args.geo}-${args.language}`,
    version: metaRaw.version ?? "1.0",
    last_updated: metaRaw.last_updated ?? new Date().toISOString().slice(0, 7),
    editor: metaRaw.editor,
    reviewer_legal: metaRaw.reviewer_legal,
    reviewer_ops: metaRaw.reviewer_ops,
    embedding_model: metaRaw.embedding_model ?? "text-embedding-3-large",
    chunk_strategy: metaRaw.chunk_strategy ?? "by_section_heading",
    status: (metaRaw.status as IndustryPackMetadata["status"]) ?? "active",
    license: metaRaw.license ?? "internal",
  };

  // Ensure every required (non-optional) section has at least a TODO marker —
  // we keep the placeholder so the validator passes, but the freshness monitor
  // can flag the cell as "stub-only".
  for (const s of KB_SECTIONS) {
    if (!sections[s] || !sections[s].trim()) {
      sections[s] = `_TODO — section ${s} not yet filled in. See docs/02a-kb-pack-template.md._`;
    }
  }

  const out: IndustryPack = {
    industry: args.industry,
    geo: args.geo,
    language: args.language,
    sections,
    metadata,
    source_url: args.source_url,
    ingested_at: new Date(),
  };

  return IndustryPackSchema.parse(out);
}

/**
 * Load a single pack from disk by industry + geo-language.
 *
 * Default `packsDir` resolves to this package's `src/packs` directory; in
 * production builds, callers should pass an absolute path because the
 * `src/packs` content is shipped under `files` in package.json.
 */
export async function loadPack(args: {
  industry: string;
  geo: string;
  language: string;
  packsDir?: string;
}): Promise<IndustryPack> {
  const dir = args.packsDir ?? defaultPacksDir();
  const filename = `${args.geo}-${args.language}.md`;
  const fullPath = path.join(dir, args.industry, filename);
  const md = await fs.readFile(fullPath, "utf-8");
  return parsePackMarkdown(md, {
    industry: args.industry,
    geo: args.geo,
    language: args.language,
    source_url: `file://${fullPath}`,
  });
}

/**
 * Walk the packs directory and parse everything.
 */
export async function loadAllPacks(packsDir?: string): Promise<IndustryPack[]> {
  const dir = packsDir ?? defaultPacksDir();
  const industries = await fs.readdir(dir, { withFileTypes: true });
  const out: IndustryPack[] = [];
  for (const d of industries) {
    if (!d.isDirectory()) continue;
    const industry = d.name;
    const files = await fs.readdir(path.join(dir, industry));
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const m = /^([a-z]{2}(?:-[a-z0-9]+)?)-([a-z]{2}(?:-[a-z0-9]+)?)\.md$/i.exec(f);
      if (!m) continue;
      const geo = m[1]!.toLowerCase();
      const language = m[2]!.toLowerCase();
      try {
        const pack = await loadPack({ industry, geo, language, packsDir: dir });
        out.push(pack);
      } catch (err) {
        // Bubble up to caller — silent skips would hide stub-corruption.
        throw new Error(`failed to load pack ${industry}/${f}: ${err}`);
      }
    }
  }
  return out;
}

function defaultPacksDir(): string {
  // Resolve relative to this file. In dist, packs are at ../src/packs;
  // in src, packs are at ./packs.
  // We use process.cwd() as a last resort, but in normal usage the
  // caller will pass `packsDir` explicitly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (import.meta as any).url as string | undefined;
  if (meta) {
    const here = new URL(".", meta).pathname.replace(/^\/([a-zA-Z]:\/)/, "$1");
    return path.resolve(here, "packs");
  }
  return path.resolve(process.cwd(), "src", "packs");
}
