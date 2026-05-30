/**
 * `@funnel/kb` — public API.
 *
 * The Industry Knowledge Base. 30 verticals × geo × language, nightly-
 * refreshed, pgvector-retrieved at generation time. The core moat.
 *
 * Common usage:
 *
 *   import { retrieve, getPack, savePack, runIngestionCycle } from "@funnel/kb";
 *
 *   // Generation-time retrieval:
 *   const results = await retrieve(
 *     { prisma, embed: embedFn },
 *     {
 *       industry: "solar",
 *       geo: "us-az",
 *       language: "en",
 *       query_text: "what hooks work for backup-power-anxious AZ buyers?",
 *       top_k: 8,
 *       section_filter: ["ad_angles", "pain_points"],
 *     },
 *   );
 *
 *   // Nightly cron:
 *   await runIngestionCycle({
 *     cells: [{ industry: "solar", geo: "us-az", language: "en" }, ...],
 *     configs,
 *     prisma,
 *     anthropic,
 *     openai,
 *   });
 */

// Types
export * from "./types.js";

// Storage
export {
  savePack,
  getPack,
  listPacks,
  insertChunk,
  retireChunk,
  activateChunk,
  toPgVectorLiteral,
  type StorageDeps,
  type PackOverview,
} from "./storage.js";

// Retrieval
export {
  retrieve,
  retrieveSection,
  invalidateCache,
  clearCache,
  computeRecencyWeight,
  type RetrievalDeps,
} from "./retrieval.js";

// Template loader
export { loadPack, loadAllPacks, parsePackMarkdown } from "./template-loader.js";

// Freshness
export {
  getFreshness,
  runFreshnessSweep,
  touchCell,
  type FreshnessOptions,
  type SweepReport,
} from "./freshness.js";

// Ingestion
export {
  runIngestionCycle,
  createNewsApiIngester,
  createRssIngester,
  createYoutubeIngester,
  createRedditIngester,
  createMetaAdLibraryIngester,
  createGoogleAdTransparencyIngester,
  createCustomerConversionIngester,
  type IngestionCell,
  type IngestionOptions,
  type IngestionRunReport,
  type IngestionSource,
  type IngestionContext,
  type IndustrySourceConfig,
  type RawIngestedItem,
  type HttpClient,
  type WhisperTranscriber,
  type ConversionSignalsReader,
  type ConversionSignal,
} from "./ingestion/index.js";

// Pipeline
export {
  judgeOne,
  judgeBatch,
  type FilterDeps,
  type FilterVerdict,
} from "./pipeline/filter.js";

export {
  createOpenAiEmbedder,
  embedAndInsertCandidates,
  type Embedder,
  type ApprovedItem,
} from "./pipeline/embed.js";

export {
  listCandidates,
  getCandidate,
  getCandidateStats,
  type ListCandidatesArgs,
  type CandidateStats,
} from "./pipeline/candidate-queue.js";

export {
  approveCandidate,
  rejectCandidate,
  requestEdits,
  getReviewQueue,
  type ReviewDeps,
  type ReviewAction,
} from "./pipeline/domain-expert-review.js";

export {
  runRetirementPass,
  type RetireOptions,
  type RetirementReport,
} from "./pipeline/retire.js";
