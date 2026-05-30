/**
 * Saved lists (segments) — workspace-scoped named filters.
 *
 * Filter format mirrors PRD §3 schema `saved_lists.filter` (JSONB). We store
 * a structured object the contacts/leads list endpoints know how to apply.
 */

import { z } from "zod";
import { newListId, type ListId } from "./ids.js";
import { type CrmStore, type ListRow, type WorkspaceId, getStore } from "./store.js";

export const SavedListFilterSchema = z.object({
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  has_email: z.boolean().optional(),
  has_phone: z.boolean().optional(),
  consent_marketing: z.boolean().optional(),
  status_in: z.array(z.string()).optional(),
  score_gte: z.number().optional(),
  score_lte: z.number().optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  custom: z.record(z.unknown()).optional(),
});
export type SavedListFilter = z.infer<typeof SavedListFilterSchema>;

export const CreateListInput = z.object({
  workspace_id: z.string(),
  name: z.string().min(1).max(120),
  entity_type: z.enum(["contact", "lead"]),
  filter: SavedListFilterSchema,
  created_by: z.string().nullable().optional(),
});
export type CreateListInput = z.infer<typeof CreateListInput>;

export async function createList(input: CreateListInput, store: CrmStore = getStore()): Promise<ListRow> {
  const parsed = CreateListInput.parse(input);
  return store.insertList({
    id: newListId(),
    workspace_id: parsed.workspace_id,
    name: parsed.name,
    entity_type: parsed.entity_type,
    filter: parsed.filter as Record<string, unknown>,
    created_by: parsed.created_by ?? null,
    created_at: new Date(),
  });
}

export async function listLists(
  workspace_id: WorkspaceId,
  entity_type?: "contact" | "lead",
  store: CrmStore = getStore(),
): Promise<ListRow[]> {
  return store.listLists(workspace_id, entity_type);
}

export async function deleteList(workspace_id: WorkspaceId, id: ListId, store: CrmStore = getStore()): Promise<void> {
  return store.deleteList(workspace_id, id);
}

export type { ListId, ListRow };
