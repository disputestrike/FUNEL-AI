/**
 * Module CRUD + ordering.
 *
 * Modules are ordered groups of lessons within a course. The ordering field is
 * a non-negative integer; `reorderModules` rewrites the contiguous sequence
 * 0..N-1 so the editor never has to deal with gaps.
 */

import { ulid } from "ulid";
import { z } from "zod";
import { ModuleInputSchema, type Module, type ModuleInput } from "./types.js";

export interface ModuleStore {
  insertModule(module: Module): Promise<void>;
  getModule(id: string): Promise<Module | null>;
  listModulesByCourse(courseId: string): Promise<Module[]>;
  updateModule(id: string, patch: Partial<Module>): Promise<Module>;
  deleteModule(id: string): Promise<void>;
  bulkUpdateOrder(updates: Array<{ id: string; order: number }>): Promise<void>;
}

export async function createModule(
  courseId: string,
  input: ModuleInput,
  store: ModuleStore,
  now: () => string = isoNow,
): Promise<Module> {
  const parsed = ModuleInputSchema.parse(input);
  const ts = now();
  const module: Module = {
    id: `mod_${ulid()}`,
    course_id: courseId,
    title: parsed.title,
    description: parsed.description,
    order: parsed.order,
    created_at: ts,
    updated_at: ts,
  };
  await store.insertModule(module);
  return module;
}

export async function updateModule(
  id: string,
  patch: Partial<ModuleInput>,
  store: ModuleStore,
  now: () => string = isoNow,
): Promise<Module> {
  const parsed = ModuleInputSchema.partial().parse(patch);
  return store.updateModule(id, { ...parsed, updated_at: now() });
}

export async function deleteModule(id: string, store: ModuleStore): Promise<void> {
  // Caller is expected to cascade-delete or refuse based on lesson count.
  await store.deleteModule(id);
}

/**
 * Reorder modules. The input is a list of module IDs in the desired order;
 * we rewrite `order` to 0..N-1 atomically.
 */
const ReorderInputSchema = z.array(z.string().min(1)).min(1);
export async function reorderModules(
  courseId: string,
  orderedIds: string[],
  store: ModuleStore,
): Promise<Module[]> {
  ReorderInputSchema.parse(orderedIds);

  const existing = await store.listModulesByCourse(courseId);
  const existingIds = new Set(existing.map((m) => m.id));

  // Defensive: every id in the input must exist on this course, and the
  // input must cover the full set (no partial reorders — keeps the API
  // surface tight and prevents accidental drops).
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Module ${id} does not belong to course ${courseId}`);
    }
  }
  if (orderedIds.length !== existing.length) {
    throw new Error(
      `reorderModules requires all module ids — got ${orderedIds.length}, expected ${existing.length}`,
    );
  }

  const updates = orderedIds.map((id, idx) => ({ id, order: idx }));
  await store.bulkUpdateOrder(updates);

  // Return the freshly-ordered list.
  const next = await store.listModulesByCourse(courseId);
  next.sort((a, b) => a.order - b.order);
  return next;
}

function isoNow(): string {
  return new Date().toISOString();
}
