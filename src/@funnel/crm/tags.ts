/**
 * Tag management — workspace-scoped string labels attached to contacts.
 * Tag uniqueness is by `(workspace_id, name)`.
 */

import { newTagId, type TagId } from "./ids.js";
import { type CrmStore, type TagRow, type WorkspaceId, getStore } from "./store.js";
import { ValidationError } from "./errors.js";

export interface CreateTagInput {
  workspace_id: WorkspaceId;
  name: string;
  color?: string;
}

export async function createTag(input: CreateTagInput, store: CrmStore = getStore()): Promise<TagRow> {
  const name = input.name.trim();
  if (!name) throw new ValidationError("tag name required");
  if (name.length > 64) throw new ValidationError("tag name too long");
  return store.upsertTag({
    id: newTagId(),
    workspace_id: input.workspace_id,
    name,
    color: input.color ?? null,
    created_at: new Date(),
  });
}

export async function listTags(workspace_id: WorkspaceId, store: CrmStore = getStore()): Promise<TagRow[]> {
  return store.listTags(workspace_id);
}

export type { TagId, TagRow };
