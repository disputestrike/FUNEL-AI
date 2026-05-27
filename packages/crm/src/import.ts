/**
 * Bulk contact import — CSV in, deduped by email or phone. Logged to the
 * activity timeline. Validation errors are returned per-row, never thrown.
 */

import { z } from "zod";
import { newImportId, type ImportId } from "./ids.js";
import { createContact, updateContact } from "./contacts.js";
import { recordActivity } from "./activity-timeline.js";
import type { CrmStore, ContactRow, WorkspaceId } from "./store.js";
import { getStore } from "./store.js";

export const ImportMappingSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  tags: z.string().optional(), // pipe-delimited column
});
export type ImportMapping = z.infer<typeof ImportMappingSchema>;

export const ImportInput = z.object({
  workspace_id: z.string(),
  csv: z.string(),
  mapping: ImportMappingSchema,
  default_country: z.string().length(2).optional(),
  /** When an existing contact matches, update its fields (else skip). */
  update_on_match: z.boolean().optional(),
  actor_user_id: z.string().nullable().optional(),
});
export type ImportInput = z.infer<typeof ImportInput>;

export interface ImportResult {
  import_id: ImportId;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

export async function importContacts(input: ImportInput, store: CrmStore = getStore()): Promise<ImportResult> {
  const parsed = ImportInput.parse(input);
  const rows = parseCsv(parsed.csv);
  const out: ImportResult = {
    import_id: newImportId(),
    total: rows.length - 1, // minus header
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  if (rows.length < 2) return out;

  const header = rows[0]!;
  const colIdx: Record<string, number | undefined> = {};
  for (const [field, colName] of Object.entries(parsed.mapping)) {
    if (!colName) continue;
    const idx = header.indexOf(colName);
    if (idx === -1) {
      out.errors.push({ row: 0, reason: `column "${colName}" not found in CSV header` });
    }
    colIdx[field] = idx === -1 ? undefined : idx;
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const get = (k: keyof ImportMapping) =>
        colIdx[k] !== undefined ? (row[colIdx[k]!] ?? "").trim() : undefined;
      const email = get("email") || undefined;
      const phone = get("phone") || undefined;
      const tagsStr = get("tags");
      const tags = tagsStr ? tagsStr.split("|").map((t) => t.trim()).filter(Boolean) : undefined;
      if (!email && !phone) {
        out.errors.push({ row: i, reason: "row has no email or phone — skipping" });
        out.skipped++;
        continue;
      }
      // attempt insert; on conflict optionally update.
      try {
        const c = await createContact({
          workspace_id: parsed.workspace_id,
          email,
          phone,
          full_name: get("full_name") || undefined,
          first_name: get("first_name") || undefined,
          last_name: get("last_name") || undefined,
          company: get("company") || undefined,
          tags,
          default_country: parsed.default_country,
          primary_source: "import",
          actor_user_id: parsed.actor_user_id ?? null,
        }, store);
        await recordActivity({
          workspace_id: parsed.workspace_id,
          contact_id: c.id,
          lead_id: null,
          kind: "imported",
          actor_user_id: parsed.actor_user_id ?? null,
          metadata: { import_id: out.import_id, row: i },
        }, store);
        out.inserted++;
      } catch (err) {
        const msg = (err as Error).message ?? "";
        if (parsed.update_on_match && msg.includes("already exists")) {
          // find existing + update
          const norm = email?.toLowerCase().trim();
          let existing: ContactRow | null = null;
          if (norm) existing = await store.findContactByEmail(parsed.workspace_id, norm);
          if (!existing && phone) existing = await store.findContactByPhone(parsed.workspace_id, phone);
          if (existing) {
            await updateContact({
              workspace_id: parsed.workspace_id,
              id: existing.id,
              full_name: get("full_name") || undefined,
              first_name: get("first_name") || undefined,
              last_name: get("last_name") || undefined,
              company: get("company") || undefined,
              tags: tags ? [...new Set([...existing.tags, ...tags])] : undefined,
              actor_user_id: parsed.actor_user_id ?? null,
            }, store);
            out.updated++;
            continue;
          }
        }
        out.errors.push({ row: i, reason: msg });
        out.skipped++;
      }
    } catch (err) {
      out.errors.push({ row: i, reason: (err as Error).message ?? "unknown" });
      out.skipped++;
    }
  }
  return out;
}

/** Tiny CSV parser supporting quoted fields with escaped quotes + commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        // skip
      } else {
        field += ch;
      }
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type { ImportId };
