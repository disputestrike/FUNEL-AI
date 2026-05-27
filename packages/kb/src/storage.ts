/**
 * @funnel/kb — Storage layer.
 *
 * Persists `IndustryPack`s into the canonical `kb_packs` table and explodes
 * each into per-section `KBChunk` rows in pgvector. The chunks live in a
 * `kb_chunks` table that this module manages via raw SQL — Prisma's
 * `Unsupported("vector(N)")` mapping is read-only so we drive embeddings
 * through `$executeRawUnsafe`.
 *
 * Table contract (see migrations):
 *
 *   CREATE TABLE kb_chunks (
 *     id            TEXT PRIMARY KEY,           -- kbc_<ulid>
 *     industry      TEXT NOT NULL,
 *     geo           TEXT NOT NULL,
 *     language      TEXT NOT NULL,
 *     section       TEXT NOT NULL,
 *     content       TEXT NOT NULL,
 *     embedding     VECTOR(3072) NOT NULL,
 *     source        TEXT NOT NULL DEFAULT 'pack_template',
 *     source_url    TEXT,
 *     license       TEXT NOT NULL DEFAULT 'internal',
 *     quality_score REAL NOT NULL DEFAULT 1.0,
 *     active        BOOLEAN NOT NULL DEFAULT TRUE,
 *     ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     expires_at    TIMESTAMPTZ,
 *     pack_id       TEXT REFERENCES kb_packs(id) ON DELETE CASCADE
 *   );
 *   CREATE INDEX kb_chunks_lookup_idx
 *     ON kb_chunks (industry, geo, language, section)
 *     WHERE active = TRUE;
 *   CREATE INDEX kb_chunks_embedding_idx
 *     ON kb_chunks USING ivfflat (embedding vector_cosine_ops)
 *     WITH (lists = 100);
 */
import type { PrismaClient } from "@prisma/client";
import { newId } from "@funnel/db";
import {
  IndustryPackSchema,
  KB_SECTIONS,
  type IndustryPack,
  type KBChunk,
  type KBSection,
} from "./types.js";

export interface StorageDeps {
  prisma: PrismaClient;
  /** Required for embedding sections at save time. */
  embed: (text: string) => Promise<number[]>;
}

/**
 * Format a number[] embedding as the pgvector literal `[v1,v2,...]`.
 * pgvector accepts this in raw SQL via cast: `'[..]'::vector`.
 */
export function toPgVectorLiteral(embedding: number[]): string {
  // Avoid scientific notation; pgvector parser is strict.
  return `[${embedding.map((v) => Number(v).toString()).join(",")}]`;
}

/**
 * Save an `IndustryPack`:
 *   1. Upserts a row into `kb_packs` (active version is the latest).
 *   2. Soft-retires previous active chunks for that (industry, geo, language).
 *   3. Embeds every section and inserts fresh `kb_chunks`.
 *
 * Returns the pack id and the count of chunks written.
 */
export async function savePack(
  deps: StorageDeps,
  pack: IndustryPack,
): Promise<{ pack_id: string; chunks_written: number }> {
  const parsed = IndustryPackSchema.parse(pack);
  const { prisma, embed } = deps;

  const packId = parsed.metadata.pack_id.startsWith("kbp_")
    ? parsed.metadata.pack_id
    : newId("kbPack");

  await prisma.$transaction(async (tx) => {
    // 1. Upsert pack row.
    await tx.$executeRawUnsafe(
      `
      INSERT INTO kb_packs (id, vertical, name, version, status, content_blob, regulatory_refs, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        content_blob = EXCLUDED.content_blob,
        regulatory_refs = EXCLUDED.regulatory_refs,
        updated_at = now()
      `,
      packId,
      parsed.industry,
      `${parsed.industry}/${parsed.geo}/${parsed.language}`,
      parsed.metadata.version,
      parsed.metadata.status,
      JSON.stringify({
        industry: parsed.industry,
        geo: parsed.geo,
        language: parsed.language,
        sections: parsed.sections,
        metadata: parsed.metadata,
      }),
      JSON.stringify([]),
    );

    // 2. Retire previous active pack-template chunks for this cell.
    await tx.$executeRawUnsafe(
      `
      UPDATE kb_chunks
         SET active = FALSE
       WHERE industry = $1 AND geo = $2 AND language = $3
         AND source = 'pack_template'
         AND active = TRUE
      `,
      parsed.industry,
      parsed.geo,
      parsed.language,
    );
  });

  // 3. Embed and insert per-section chunks. Done outside the txn to keep the
  //    transaction short — embedding calls are network-bound.
  let chunksWritten = 0;
  for (const section of KB_SECTIONS) {
    const content = parsed.sections[section];
    if (!content || !content.trim()) continue;

    const embedding = await embed(content);
    const chunkId = newId("kbp") + "_c";
    const literal = toPgVectorLiteral(embedding);

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO kb_chunks (
        id, industry, geo, language, section, content,
        embedding, source, source_url, license, quality_score, active,
        ingested_at, expires_at, pack_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10, $11, TRUE, now(), $12, $13)
      `,
      chunkId,
      parsed.industry,
      parsed.geo,
      parsed.language,
      section,
      content,
      literal,
      "pack_template",
      parsed.source_url ?? null,
      parsed.metadata.license,
      1.0,
      parsed.expires_at ?? null,
      packId,
    );
    chunksWritten += 1;
  }

  return { pack_id: packId, chunks_written: chunksWritten };
}

interface KbPackRow {
  id: string;
  content_blob: { sections?: Record<string, string>; metadata?: Record<string, unknown> };
  updated_at: Date;
}

/**
 * Full pack retrieval. Returns the most recently updated `active` pack
 * for the (industry, geo, language) cell or `null` if none exists.
 */
export async function getPack(
  deps: Pick<StorageDeps, "prisma">,
  industry: string,
  geo: string,
  language: string,
): Promise<IndustryPack | null> {
  const rows = await deps.prisma.$queryRawUnsafe<KbPackRow[]>(
    `
    SELECT id, content_blob, updated_at
      FROM kb_packs
     WHERE vertical = $1
       AND name = $2
       AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1
    `,
    industry,
    `${industry}/${geo}/${language}`,
  );

  if (!rows.length) return null;
  const row = rows[0];
  if (!row) return null;
  const blob = row.content_blob ?? {};

  return IndustryPackSchema.parse({
    industry,
    geo,
    language,
    sections: blob.sections ?? {},
    metadata: blob.metadata ?? { pack_id: row.id, version: "1.0", last_updated: "" },
    ingested_at: row.updated_at,
  });
}

export interface PackOverview {
  pack_id: string;
  industry: string;
  geo: string;
  language: string;
  version: string;
  status: string;
  last_updated: Date;
  chunk_count: number;
}

/**
 * Admin listing — every pack with its chunk count. Used by the
 * /admin/kb dashboard.
 */
export async function listPacks(
  deps: Pick<StorageDeps, "prisma">,
): Promise<PackOverview[]> {
  const rows = await deps.prisma.$queryRawUnsafe<
    Array<{
      id: string;
      vertical: string;
      name: string;
      version: string;
      status: string;
      updated_at: Date;
      chunk_count: bigint;
    }>
  >(`
    SELECT p.id, p.vertical, p.name, p.version, p.status, p.updated_at,
           COALESCE(c.cnt, 0)::bigint AS chunk_count
      FROM kb_packs p
      LEFT JOIN (
        SELECT pack_id, COUNT(*) AS cnt
          FROM kb_chunks
         WHERE active = TRUE
         GROUP BY pack_id
      ) c ON c.pack_id = p.id
     ORDER BY p.vertical, p.updated_at DESC
  `);

  return rows.map((r) => {
    const [, geo = "", language = ""] = r.name.split("/");
    return {
      pack_id: r.id,
      industry: r.vertical,
      geo,
      language,
      version: r.version,
      status: r.status,
      last_updated: r.updated_at,
      chunk_count: Number(r.chunk_count),
    };
  });
}

/**
 * Insert a non-pack-template chunk (news, RSS, Reddit, etc.) — used by the
 * ingestion pipeline after the LLM-as-judge filter approves an item.
 */
export async function insertChunk(
  deps: StorageDeps,
  chunk: Omit<KBChunk, "embedding"> & { embedding?: number[] },
): Promise<string> {
  const embedding = chunk.embedding ?? (await deps.embed(chunk.content));
  const id = chunk.id ?? newId("kbp") + "_c";
  const literal = toPgVectorLiteral(embedding);

  await deps.prisma.$executeRawUnsafe(
    `
    INSERT INTO kb_chunks (
      id, industry, geo, language, section, content,
      embedding, source, source_url, license, quality_score, active,
      ingested_at, expires_at, pack_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10, $11, $12, $13, $14, NULL)
    `,
    id,
    chunk.industry,
    chunk.geo,
    chunk.language,
    chunk.section as KBSection,
    chunk.content,
    literal,
    chunk.source,
    chunk.source_url ?? null,
    chunk.license,
    chunk.quality_score ?? 1.0,
    chunk.active,
    chunk.ingested_at,
    chunk.expires_at ?? null,
  );

  return id;
}

/**
 * Soft-retire a chunk. Used by retire.ts.
 */
export async function retireChunk(
  deps: Pick<StorageDeps, "prisma">,
  chunkId: string,
  reason: string,
): Promise<void> {
  await deps.prisma.$executeRawUnsafe(
    `UPDATE kb_chunks SET active = FALSE WHERE id = $1`,
    chunkId,
  );
  // The reason is logged via the event bus by the caller; we don't write
  // it to the row (kb_chunks doesn't carry a "retire_reason" column on
  // purpose — keep the table narrow, use the event log as audit trail).
  void reason;
}

/**
 * Mark a chunk active again (used after domain-expert approval moves
 * candidate → active).
 */
export async function activateChunk(
  deps: Pick<StorageDeps, "prisma">,
  chunkId: string,
): Promise<void> {
  await deps.prisma.$executeRawUnsafe(
    `UPDATE kb_chunks SET active = TRUE WHERE id = $1`,
    chunkId,
  );
}
