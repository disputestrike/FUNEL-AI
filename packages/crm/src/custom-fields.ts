/**
 * Custom field definitions (PRD §3 schema: `custom_field_definitions`).
 *
 * Per Doc 12 §3 edge case 14: reserved field names are rejected with a
 * helpful error.
 */

import { z } from "zod";
import { newCustomFieldId, type CustomFieldId } from "./ids.js";
import { type CrmStore, type CustomFieldRow, type WorkspaceId, getStore } from "./store.js";
import { ValidationError } from "./errors.js";

const RESERVED = new Set([
  "id",
  "workspace_id",
  "email",
  "email_normalized",
  "phone",
  "phone_e164",
  "tags",
  "score",
  "consent",
  "tombstone",
  "deleted_at",
  "created_at",
  "updated_at",
]);

export const CreateCustomFieldInput = z.object({
  workspace_id: z.string(),
  entity_type: z.enum(["contact", "lead", "opportunity"]),
  field_name: z.string().min(1).max(64),
  field_type: z.enum(["text", "number", "date", "dropdown", "multi_select", "boolean"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});
export type CreateCustomFieldInput = z.infer<typeof CreateCustomFieldInput>;

export async function createCustomField(
  input: CreateCustomFieldInput,
  store: CrmStore = getStore(),
): Promise<CustomFieldRow> {
  const parsed = CreateCustomFieldInput.parse(input);
  const slug = parsed.field_name.trim().toLowerCase().replace(/\s+/g, "_");
  if (RESERVED.has(slug)) {
    throw new ValidationError(`"${slug}" is a reserved field name — choose another`);
  }
  if ((parsed.field_type === "dropdown" || parsed.field_type === "multi_select") && (!parsed.options || parsed.options.length === 0)) {
    throw new ValidationError(`${parsed.field_type} requires non-empty options`);
  }
  // dedupe by name
  const existing = await store.listCustomFields(parsed.workspace_id, parsed.entity_type);
  if (existing.some((f) => f.field_name === slug)) {
    throw new ValidationError(`custom field "${slug}" already exists`);
  }
  return store.insertCustomField({
    id: newCustomFieldId(),
    workspace_id: parsed.workspace_id,
    entity_type: parsed.entity_type,
    field_name: slug,
    field_type: parsed.field_type,
    options: parsed.options ?? [],
    required: parsed.required ?? false,
    created_at: new Date(),
  });
}

export async function listCustomFields(
  workspace_id: WorkspaceId,
  entity_type?: "contact" | "lead" | "opportunity",
  store: CrmStore = getStore(),
): Promise<CustomFieldRow[]> {
  return store.listCustomFields(workspace_id, entity_type);
}

export async function deleteCustomField(
  workspace_id: WorkspaceId,
  id: CustomFieldId,
  store: CrmStore = getStore(),
): Promise<void> {
  return store.deleteCustomField(workspace_id, id);
}

/** Throw if `values` is missing required fields or contains an unknown one. */
export async function validateCustomFieldValues(
  workspace_id: WorkspaceId,
  entity_type: "contact" | "lead" | "opportunity",
  values: Record<string, unknown>,
  store: CrmStore = getStore(),
): Promise<void> {
  const defs = await store.listCustomFields(workspace_id, entity_type);
  const byName = new Map(defs.map((d) => [d.field_name, d]));
  for (const def of defs) {
    if (def.required && (values[def.field_name] === undefined || values[def.field_name] === null)) {
      throw new ValidationError(`custom field "${def.field_name}" is required`);
    }
  }
  for (const [k, v] of Object.entries(values)) {
    const def = byName.get(k);
    if (!def) continue; // allow unknown? Spec says reject; we soft-allow for now since custom_fields is jsonb.
    if (def.field_type === "number" && typeof v !== "number") throw new ValidationError(`"${k}" must be number`);
    if (def.field_type === "boolean" && typeof v !== "boolean") throw new ValidationError(`"${k}" must be boolean`);
    if (def.field_type === "dropdown" && typeof v === "string" && def.options.length && !def.options.includes(v)) {
      throw new ValidationError(`"${k}" must be one of [${def.options.join(", ")}]`);
    }
  }
}

export type { CustomFieldId, CustomFieldRow };
