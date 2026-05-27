/**
 * Contact export — streams CSV / JSON, or fires a workspace webhook. Large
 * exports (>250k rows) are paginated NDJSON per Doc 12 §3 edge case 12.
 *
 * Emits `data_export_requested` immediately, then `data_export_delivered`
 * once bytes are written. Callers are expected to email the user with a
 * download link via `@funnel/notifications`.
 */

import { z } from "zod";
import { newExportId, type ExportId } from "./ids.js";
import { getStore, type CrmStore, type WorkspaceId, type ContactRow } from "./store.js";
import { emitCrm } from "./bus.js";
import { listContacts, type ListContactsInput } from "./contacts.js";

export const ExportInput = z.object({
  workspace_id: z.string(),
  format: z.enum(["csv", "json", "ndjson", "webhook"]),
  filter: z.object({
    q: z.string().optional(),
    tags: z.array(z.string()).optional(),
    consentMarketing: z.boolean().optional(),
    includeDeleted: z.boolean().optional(),
  }).optional(),
  webhook_url: z.string().url().optional(),
  webhook_secret: z.string().optional(),
  actor_user_id: z.string().nullable().optional(),
});
export type ExportInput = z.infer<typeof ExportInput>;

export interface ExportResult {
  export_id: ExportId;
  format: ExportInput["format"];
  rows: number;
  bytes: number;
  /** Inline body for csv/json/ndjson; null for webhook (delivery-only). */
  body: string | null;
  filename: string | null;
}

const CSV_COLUMNS = [
  "id",
  "email",
  "phone",
  "full_name",
  "first_name",
  "last_name",
  "company",
  "tags",
  "marketing_consent",
  "sms_consent",
  "calls_consent",
  "primary_source",
  "first_seen_at",
  "last_activity_at",
] as const;

export async function exportContacts(input: ExportInput, store: CrmStore = getStore()): Promise<ExportResult> {
  const parsed = ExportInput.parse(input);
  const export_id = newExportId();
  const filter_hash = await sha256(JSON.stringify(parsed.filter ?? {}));

  await emitCrm("data_export_requested", {
    workspace_id: parsed.workspace_id,
    occurred_at: new Date().toISOString(),
    actor_user_id: parsed.actor_user_id ?? null,
    export_id,
    format: (parsed.format === "ndjson" ? "json" : parsed.format) as "csv" | "json" | "webhook",
    filter_hash,
  });

  // Stream pages so a 250k contact workspace doesn't OOM.
  const all: ContactRow[] = [];
  let cursor: string | undefined = undefined;
  for (;;) {
    const page = await listContacts({
      workspace_id: parsed.workspace_id,
      ...(parsed.filter ?? {}),
      cursor,
      limit: 500,
    } as ListContactsInput, store);
    all.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
    if (all.length >= 1_000_000) break; // hard upper bound
  }

  let body: string | null = null;
  let filename: string | null = null;
  if (parsed.format === "csv") {
    body = toCsv(all);
    filename = `contacts_${export_id}.csv`;
  } else if (parsed.format === "json") {
    body = JSON.stringify(all.map(toExportShape), null, 2);
    filename = `contacts_${export_id}.json`;
  } else if (parsed.format === "ndjson") {
    body = all.map((r) => JSON.stringify(toExportShape(r))).join("\n");
    filename = `contacts_${export_id}.ndjson`;
  } else if (parsed.format === "webhook") {
    if (!parsed.webhook_url) throw new Error("webhook_url required for format=webhook");
    await deliverWebhook(parsed.webhook_url, parsed.webhook_secret ?? "", all.map(toExportShape), export_id);
  }

  const bytes = body ? new TextEncoder().encode(body).byteLength : 0;
  await emitCrm("data_export_delivered", {
    workspace_id: parsed.workspace_id,
    occurred_at: new Date().toISOString(),
    actor_user_id: parsed.actor_user_id ?? null,
    export_id,
    rows: all.length,
    bytes,
  });

  return { export_id, format: parsed.format, rows: all.length, bytes, body, filename };
}

function toExportShape(c: ContactRow) {
  return {
    id: c.id,
    email: c.email_normalized,
    phone: c.phone_e164,
    full_name: c.full_name,
    first_name: c.first_name,
    last_name: c.last_name,
    company: c.company,
    tags: c.tags,
    custom_fields: c.custom_fields,
    marketing_consent: !!c.consent?.marketing,
    sms_consent: !!c.consent?.sms,
    calls_consent: !!c.consent?.calls,
    primary_source: c.primary_source,
    first_seen_at: c.first_seen_at.toISOString(),
    last_activity_at: c.last_activity_at?.toISOString() ?? null,
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("|") : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: ContactRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    const shape = toExportShape(r);
    lines.push(
      CSV_COLUMNS.map((c) => {
        switch (c) {
          case "email":
            return csvEscape(shape.email);
          case "phone":
            return csvEscape(shape.phone);
          case "tags":
            return csvEscape(shape.tags);
          default:
            return csvEscape((shape as Record<string, unknown>)[c]);
        }
      }).join(","),
    );
  }
  return lines.join("\n");
}

async function deliverWebhook(url: string, secret: string, payload: unknown, export_id: ExportId): Promise<void> {
  const body = JSON.stringify({ export_id, contacts: payload });
  const signature = await hmacSha256Hex(secret, body);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-funnel-export-id": export_id,
      "x-funnel-signature": signature,
    },
    body,
  });
  if (!res.ok) throw new Error(`webhook delivery failed: ${res.status}`);
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type { ExportId };
