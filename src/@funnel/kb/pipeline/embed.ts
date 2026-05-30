/**
 * Embedding stage.
 *
 * Wraps OpenAI's `text-embedding-3-large` (3072-dim). Provides:
 *   - `createOpenAiEmbedder` — production embedder.
 *   - `embedAndInsert` — for each approved item, embed and insert into
 *     `kb_chunks` as inactive (candidate) for the domain-expert review queue.
 *
 * Batches up to 96 inputs per OpenAI call (the API supports more but
 * batches over ~100 frequently 502).
 */
import type OpenAI from "openai";
import type { PrismaClient } from "@prisma/client";
import { newId } from "@funnel/db";
import { DEFAULT_EMBEDDING_MODEL } from "../types.js";
import type { RawIngestedItem } from "../ingestion/types.js";
import type { FilterVerdict } from "./filter.js";
import { toPgVectorLiteral } from "../storage.js";

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export function createOpenAiEmbedder(
  openai: OpenAI,
  model: string = DEFAULT_EMBEDDING_MODEL,
): Embedder {
  return {
    async embed(text) {
      const resp = await openai.embeddings.create({
        model,
        input: text,
      });
      const e = resp.data[0]?.embedding;
      if (!e) throw new Error("openai.embeddings.create returned no embedding");
      return e as number[];
    },
    async embedBatch(texts) {
      if (!texts.length) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < texts.length; i += 96) chunks.push(texts.slice(i, i + 96));
      const out: number[][] = [];
      for (const batch of chunks) {
        const resp = await openai.embeddings.create({ model, input: batch });
        for (const d of resp.data) out.push(d.embedding as number[]);
      }
      return out;
    },
  };
}

export interface ApprovedItem {
  item: RawIngestedItem;
  verdict: FilterVerdict;
}

/**
 * Embed approved items and insert them as candidates (active=FALSE) into
 * `kb_chunks`. Each row has a corresponding `kb_candidate_queue` row so the
 * domain-expert UI can find it.
 *
 * Returns inserted chunk ids.
 */
export async function embedAndInsertCandidates(
  prisma: PrismaClient,
  embedder: Embedder,
  approved: ApprovedItem[],
): Promise<string[]> {
  if (!approved.length) return [];

  const embeddings = await embedder.embedBatch(approved.map((a) => a.item.content));
  const ids: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < approved.length; i++) {
      const a = approved[i];
      const emb = embeddings[i];
      if (!a || !emb) continue;
      const id = newId("kbp") + "_c";
      ids.push(id);

      // Idempotent on external_id — re-running an ingester won't dupe.
      // The unique partial index is on (industry, geo, language, source,
      // (raw->>'external_id')) in the kb_candidate_queue table.
      await tx.$executeRawUnsafe(
        `
        INSERT INTO kb_chunks (
          id, industry, geo, language, section, content,
          embedding, source, source_url, license, quality_score, active,
          ingested_at, expires_at, pack_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10, $11, FALSE, $12, NULL, NULL)
        ON CONFLICT DO NOTHING
        `,
        id,
        a.item.industry,
        a.item.geo,
        a.item.language,
        a.verdict.section,
        a.item.content,
        toPgVectorLiteral(emb),
        a.item.source,
        a.item.source_url,
        a.item.license,
        a.verdict.quality,
        a.item.published_at,
      );

      await tx.$executeRawUnsafe(
        `
        INSERT INTO kb_candidate_queue (
          id, chunk_id, external_id, industry, geo, language, section,
          source, filter_verdict, proposed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
        ON CONFLICT (external_id) DO NOTHING
        `,
        newId("kbp") + "_q",
        id,
        a.item.external_id,
        a.item.industry,
        a.item.geo,
        a.item.language,
        a.verdict.section,
        a.item.source,
        JSON.stringify(a.verdict),
      );
    }
  });

  return ids;
}
