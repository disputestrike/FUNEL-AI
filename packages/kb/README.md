# `@funnel/kb` â€” Industry Knowledge Base

The Industry Knowledge Base is GoFunnelAI's core moat. 30 vertical packs Ã—
geography Ã— language, refreshed nightly, retrieved at generation time via
pgvector cosine similarity. Static KBs rot in 90 days. This one doesn't.

Companion docs:
- `docs/02a-kb-pack-template.md` â€” the canonical 24-section pack template.
- `docs/02b-kb-pack-solar-example.md` â€” the gold-standard solar exemplar.
- `docs/03-event-taxonomy-and-schemas.md` â€” the lake structure the
  ingestion pipeline reads and writes.

## What's in this package

```
src/
  types.ts                   â€” IndustryPack, KBChunk, RetrievalQuery, sections
  storage.ts                 â€” savePack, getPack, listPacks (Prisma + pgvector)
  retrieval.ts               â€” retrieve() with recency-weighted scoring + 1h cache
  freshness.ts               â€” staleness monitor (>7d alerts ops)
  template-loader.ts         â€” parses src/packs/<industry>/<geo>-<lang>.md
  ingestion/
    index.ts                 â€” nightly orchestrator
    newsapi.ts               â€” NewsAPI.org
    rss.ts                   â€” RSS / Atom (cheerio + rss-parser)
    youtube.ts               â€” YouTube Data API + Whisper fallback
    reddit.ts                â€” Reddit OAuth + r/<industry>
    meta-ad-library.ts       â€” Meta Ad Library (active ads per page)
    google-ad-transparency.ts â€” Google Ad Transparency Center
    customer-conversion.ts   â€” Iceberg-lake conversion signals (the flywheel)
  pipeline/
    filter.ts                â€” LLM-as-judge (Claude Haiku 4.5)
    embed.ts                 â€” OpenAI text-embedding-3-large + insert
    candidate-queue.ts       â€” candidate listing for admin UI
    domain-expert-review.ts  â€” approve / reject / request-edits
    retire.ts                â€” quarterly retirement of stale/unused chunks
  packs/                     â€” 30 industry pack templates (markdown)
```

## Retrieval contract

```ts
import { retrieve } from "@funnel/kb";

const results = await retrieve(
  { prisma, embed: embedFn },
  {
    industry: "solar",
    geo: "us-az",
    language: "en",
    query_text: "what hooks work for backup-power-anxious AZ buyers?",
    top_k: 8,
    section_filter: ["ad_angles", "pain_points"],
    recency_half_life_days: 90,
  },
);

for (const r of results) {
  console.log(r.score, r.similarity, r.chunk.section, r.chunk.content);
}
```

Final score = `cosine_similarity Ã— exp(-age_days Ã— ln 2 / half_life) Ã— quality_score`.

## Saving a pack

```ts
import { loadPack, savePack, createOpenAiEmbedder } from "@funnel/kb";
import OpenAI from "openai";

const pack = await loadPack({ industry: "solar", geo: "us", language: "en" });
const embedder = createOpenAiEmbedder(new OpenAI());
await savePack({ prisma, embed: embedder.embed }, pack);
```

`savePack` upserts the pack row in `kb_packs` and writes one embedded chunk
per canonical section (24 total) into `kb_chunks`.

## Nightly ingestion

```ts
import { runIngestionCycle } from "@funnel/kb";

await runIngestionCycle({
  cells: [
    { industry: "solar", geo: "us-az", language: "en" },
    { industry: "med-spa", geo: "us", language: "en" },
    // ...
  ],
  configs: industrySourceConfigs,
  prisma, anthropic, openai,
  conversionReader: lakeReader,
});
```

The orchestrator fans out across cells, dedupes by external id, runs the
Haiku 4.5 filter, embeds approved items via `text-embedding-3-large`, and
inserts them as candidates in `kb_candidate_queue` for human approval.

## Ingestion sources (7)

1. NewsAPI.org â€” industry news per vertical
2. RSS â€” top 20 authority blogs per industry
3. YouTube Data API + Whisper fallback â€” transcripts from top channels
4. Reddit â€” `r/<industry>` hot threads (verbatim buyer phrasings)
5. Meta Ad Library â€” what ads competitors are running
6. Google Ad Transparency Center â€” same for Google
7. Customer Conversion (Iceberg lake) â€” anonymized conversion signals (the flywheel)

## Supported industries (30)

```
solar (filled exemplar)
med-spa, hvac, roofing, real-estate-residential, real-estate-investor,
mortgage, insurance-life, insurance-medicare, dental, chiropractic,
fitness, weight-loss-glp1, law-personal-injury, law-family, law-immigration,
coaching-business, coaching-fitness, saas-smb, ecommerce-dtc,
home-services-pest, home-services-cleaning, home-services-plumbing,
home-services-landscaping, automotive-dealer, education-online-course,
education-higher-ed, financial-advisor, windows-doors, pool-spa  (stub)
```

Each stub needs a domain-expert pass per `02a-kb-pack-template.md`.

## Required Postgres schema

This package expects these tables (in addition to the `kb_packs` row already
in Prisma schema):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_chunks (
  id            TEXT PRIMARY KEY,
  industry      TEXT NOT NULL,
  geo           TEXT NOT NULL,
  language      TEXT NOT NULL,
  section       TEXT NOT NULL,
  content       TEXT NOT NULL,
  embedding     VECTOR(3072) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'pack_template',
  source_url    TEXT,
  license       TEXT NOT NULL DEFAULT 'internal',
  quality_score REAL NOT NULL DEFAULT 1.0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  pack_id       TEXT REFERENCES kb_packs(id) ON DELETE CASCADE
);
CREATE INDEX kb_chunks_lookup_idx ON kb_chunks (industry, geo, language, section) WHERE active = TRUE;
CREATE INDEX kb_chunks_embedding_idx ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE kb_candidate_queue (
  id              TEXT PRIMARY KEY,
  chunk_id        TEXT NOT NULL REFERENCES kb_chunks(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL UNIQUE,
  industry        TEXT NOT NULL,
  geo             TEXT NOT NULL,
  language        TEXT NOT NULL,
  section         TEXT NOT NULL,
  source          TEXT NOT NULL,
  filter_verdict  JSONB NOT NULL,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewer_user_id TEXT,
  review_decision TEXT,
  review_notes    TEXT
);
CREATE INDEX kb_candidate_unreviewed_idx ON kb_candidate_queue (industry, proposed_at DESC)
  WHERE reviewed_at IS NULL;

CREATE TABLE kb_chunk_usage (
  chunk_id          TEXT PRIMARY KEY REFERENCES kb_chunks(id) ON DELETE CASCADE,
  last_retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retrievals_count  BIGINT NOT NULL DEFAULT 0
);
```

## Cron wiring

```cron
0 3 * * * cd /opt/funnel-ai/packages/kb && pnpm ingest:nightly
0 4 * * 0 cd /opt/funnel-ai/packages/kb && pnpm tsx src/pipeline/retire.ts
*/5 * * * * cd /opt/funnel-ai/packages/kb && pnpm tsx src/freshness.ts | alert-if-stale
```

## Tests

```
pnpm --filter @funnel/kb test
```

Covers retrieval correctness (mocked pgvector), recency-weighted scoring,
LLM-as-judge filter, ingestion orchestration, and pack template parsing.
