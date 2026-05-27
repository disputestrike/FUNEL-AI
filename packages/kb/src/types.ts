/**
 * @funnel/kb — Core KB types.
 *
 * The Industry KB is the core moat. Each `IndustryPack` is the canonical
 * filled-in pack template (see docs/02a-kb-pack-template.md) for one
 * `industry × geo × language` cell. Packs are decomposed into `KBChunk`s
 * — one per canonical section — embedded with `text-embedding-3-large`,
 * and stored in pgvector for retrieval at generation time.
 *
 * Vocabulary
 * ----------
 *   - `industry`  — slug-cased vertical name (e.g. "solar", "med-spa").
 *   - `geo`       — ISO 3166-1 alpha-2 country, optional region suffix
 *                    ("us", "us-az", "us-ca", "gb", "ca-on").
 *   - `language`  — IETF BCP-47 language tag ("en", "es", "fr-CA").
 *   - `section`   — one of the 24 canonical section anchors.
 *
 * Retrieval anchors are the section IDs from the pack template; if you
 * rename one of these, retrieval breaks across every pack. Don't.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Canonical section anchors (matches doc 02a §0 "do not rename headings").
// These are the stable retrieval keys used by the generation engine.
// ---------------------------------------------------------------------------

export const KB_SECTIONS = [
  "market_overview",
  "buyer_personas",
  "pain_points",
  "urgency_triggers",
  "common_objections",
  "proof_types",
  "offers",
  "lead_magnets",
  "funnel_archetypes",
  "ad_angles",
  "prohibited_claims",
  "compliance_rules",
  "form_fields",
  "lead_scoring_rules",
  "revtry_script",
  "sms_sequences",
  "email_sequences",
  "benchmarks_cpl",
  "benchmark_conversion_rates",
  "seasonal_cycles",
  "example_funnels",
  "glossary",
  "sources_citations",
  "pack_metadata",
] as const;

export type KBSection = (typeof KB_SECTIONS)[number];

export const KB_SECTION_SET = new Set<KBSection>(KB_SECTIONS);

/**
 * Mapping from canonical section id → markdown heading number used in the
 * pack template. Used by `template-loader.ts` to parse markdown back into
 * structured sections.
 */
export const SECTION_HEADING_NUMBERS: Record<KBSection, number> = {
  market_overview: 1,
  buyer_personas: 2,
  pain_points: 3,
  urgency_triggers: 4,
  common_objections: 5,
  proof_types: 6,
  offers: 7,
  lead_magnets: 8,
  funnel_archetypes: 9,
  ad_angles: 10,
  prohibited_claims: 11,
  compliance_rules: 12,
  form_fields: 13,
  lead_scoring_rules: 14,
  revtry_script: 15,
  sms_sequences: 16,
  email_sequences: 17,
  benchmarks_cpl: 18,
  benchmark_conversion_rates: 19,
  seasonal_cycles: 20,
  example_funnels: 21,
  glossary: 22,
  sources_citations: 23,
  pack_metadata: 24,
};

// ---------------------------------------------------------------------------
// Embedding model contract.
// ---------------------------------------------------------------------------

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large" as const;
export const DEFAULT_EMBEDDING_DIM = 3072 as const;

// ---------------------------------------------------------------------------
// IndustryPack — the canonical filled KB pack.
// ---------------------------------------------------------------------------

export const IndustryPackSectionsSchema = z.object({
  market_overview: z.string().min(1),
  buyer_personas: z.string().min(1),
  pain_points: z.string().min(1),
  urgency_triggers: z.string().min(1),
  common_objections: z.string().min(1),
  proof_types: z.string().min(1),
  offers: z.string().min(1),
  lead_magnets: z.string().min(1),
  funnel_archetypes: z.string().min(1),
  ad_angles: z.string().min(1),
  prohibited_claims: z.string().min(1),
  compliance_rules: z.string().min(1),
  form_fields: z.string().min(1),
  lead_scoring_rules: z.string().min(1),
  revtry_script: z.string().min(1),
  sms_sequences: z.string().min(1),
  email_sequences: z.string().min(1),
  benchmarks_cpl: z.string().min(1),
  benchmark_conversion_rates: z.string().min(1),
  seasonal_cycles: z.string().min(1),
  example_funnels: z.string().min(1),
  glossary: z.string().optional().default(""),
  sources_citations: z.string().optional().default(""),
  pack_metadata: z.string().optional().default(""),
});

export type IndustryPackSections = z.infer<typeof IndustryPackSectionsSchema>;

export const IndustryPackMetadataSchema = z.object({
  pack_id: z.string().min(1),
  version: z.string().min(1),
  last_updated: z.string().min(1),
  editor: z.string().optional(),
  reviewer_legal: z.string().optional(),
  reviewer_ops: z.string().optional(),
  embedding_model: z.string().default(DEFAULT_EMBEDDING_MODEL),
  chunk_strategy: z.string().default("by_section_heading"),
  status: z.enum(["draft", "active", "deprecated"]).default("active"),
  license: z.string().default("internal"),
});

export type IndustryPackMetadata = z.infer<typeof IndustryPackMetadataSchema>;

export const IndustryPackSchema = z.object({
  industry: z.string().min(1),
  geo: z.string().min(1),
  language: z.string().min(1),
  sections: IndustryPackSectionsSchema,
  metadata: IndustryPackMetadataSchema,
  source_url: z.string().optional(),
  ingested_at: z.date().default(() => new Date()),
  expires_at: z.date().optional(),
});

export type IndustryPack = z.infer<typeof IndustryPackSchema>;

// ---------------------------------------------------------------------------
// KBChunk — an individual embedded chunk in pgvector.
// ---------------------------------------------------------------------------

export const KBChunkSchema = z.object({
  id: z.string().optional(),
  industry: z.string().min(1),
  geo: z.string().min(1),
  language: z.string().min(1),
  section: z.enum(KB_SECTIONS),
  content: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  source_url: z.string().nullable().optional(),
  license: z.string().default("internal"),
  ingested_at: z.date(),
  expires_at: z.date().nullable().optional(),
  active: z.boolean().default(true),
  /** Quality signal in [0, 1]; survives the LLM-as-judge filter. */
  quality_score: z.number().min(0).max(1).optional(),
  /** Provenance: which ingestion source produced this chunk. */
  source: z
    .enum([
      "pack_template",
      "newsapi",
      "rss",
      "youtube",
      "reddit",
      "meta_ad_library",
      "google_ad_transparency",
      "customer_conversion",
      "manual",
    ])
    .default("pack_template"),
});

export type KBChunk = z.infer<typeof KBChunkSchema>;

// ---------------------------------------------------------------------------
// RetrievalQuery — input to retrieval.retrieve().
// ---------------------------------------------------------------------------

export const RetrievalQuerySchema = z.object({
  industry: z.string().min(1),
  geo: z.string().min(1),
  language: z.string().min(1),
  query_text: z.string().min(1),
  top_k: z.number().int().positive().max(50).default(8),
  section_filter: z.array(z.enum(KB_SECTIONS)).optional(),
  /**
   * Half-life in days for the recency boost. Lower values favor recent
   * material more heavily. Default 90d matches our "static KBs rot in
   * 90 days" thesis — items older than this lose >50% of recency weight.
   */
  recency_half_life_days: z.number().positive().default(90),
  /** Skip items whose `quality_score` is below this. */
  min_quality: z.number().min(0).max(1).default(0),
  /** Skip items past `expires_at`. */
  exclude_expired: z.boolean().default(true),
  /** If true, candidates (not yet domain-expert approved) are included. */
  include_candidates: z.boolean().default(false),
});

export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;

// ---------------------------------------------------------------------------
// Retrieval result.
// ---------------------------------------------------------------------------

export interface RetrievalResult {
  chunk: KBChunk;
  /** Cosine similarity in [-1, 1]; pgvector returns 1 - distance. */
  similarity: number;
  /** Recency multiplier applied to similarity (exp decay, half-life). */
  recency_weight: number;
  /** Final score = similarity * recency_weight * quality_score. */
  score: number;
  provenance: {
    source: KBChunk["source"];
    source_url: string | null;
    ingested_at: Date;
    license: string;
  };
}

// ---------------------------------------------------------------------------
// Candidate queue entry — items pending domain-expert review.
// ---------------------------------------------------------------------------

export interface CandidateChunk extends KBChunk {
  candidate_id: string;
  filter_verdict: {
    keep: boolean;
    reason: string;
    confidence: number;
    judge_model: string;
  };
  proposed_at: Date;
  reviewed_at?: Date;
  reviewer_user_id?: string;
  review_decision?: "approved" | "rejected" | "edits_required";
  review_notes?: string;
}

// ---------------------------------------------------------------------------
// Freshness snapshot.
// ---------------------------------------------------------------------------

export interface FreshnessReport {
  industry: string;
  geo: string;
  language: string;
  last_ingested_at: Date | null;
  age_days: number;
  stale: boolean;
  chunk_count: number;
  candidate_count: number;
  active_count: number;
  retired_count: number;
}
