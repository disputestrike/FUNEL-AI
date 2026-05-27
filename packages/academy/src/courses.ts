/**
 * Course CRUD + catalog read APIs.
 *
 * A "course" is the unit shown on the Academy catalog card. It contains
 * an ordered list of modules, each with an ordered list of lessons. Free
 * courses launch immediately on publish; paid courses require a PaidProgram
 * row (see paid-academy.ts) before the catalog will show a "Buy" CTA.
 */

import { ulid } from "ulid";
import { z } from "zod";
import {
  COURSE_TIERS,
  CourseMetaSchema,
  INDUSTRY_VERTICALS,
  ModuleInputSchema,
  LessonInputSchema,
  type Course,
  type CourseLevel,
  type CourseMeta,
  type CourseStatus,
  type IndustryVertical,
  type LessonInput,
  type Module,
  type Lesson,
  type ModuleInput,
} from "./types.js";

/* ===== Storage shape — repository pattern =============================== */

/**
 * Storage adapter the caller injects. In production this is backed by Postgres
 * (Doc 03 schemas live in `@funnel/db`); in tests it's an in-memory map.
 * Decoupling lets the package stay infra-agnostic.
 */
export interface CourseStore {
  insertCourse(course: Course): Promise<void>;
  getCourse(id: string): Promise<Course | null>;
  getCourseBySlug(slug: string): Promise<Course | null>;
  updateCourse(id: string, patch: Partial<Course>): Promise<Course>;
  listCourses(filter: ListCoursesFilter): Promise<Course[]>;

  insertModules(modules: Module[]): Promise<void>;
  listModulesByCourse(courseId: string): Promise<Module[]>;
  insertLessons(lessons: Lesson[]): Promise<void>;
  listLessonsByCourse(courseId: string): Promise<Lesson[]>;
}

export interface ListCoursesFilter {
  tier?: "free" | "paid" | "all";
  industry?: IndustryVertical | "all";
  status?: CourseStatus | "all";
  level?: CourseLevel | "all";
  /** Strategist-ladder filter for the certification page. */
  counts_toward_strategist?: boolean;
  /** Free-text search over title/description. */
  q?: string;
  limit?: number;
  offset?: number;
}

/* ===== Public API ====================================================== */

const CreateCourseInputSchema = z.object({
  meta: CourseMetaSchema,
  modules: z
    .array(
      ModuleInputSchema.extend({
        lessons: z.array(LessonInputSchema).default([]),
      }),
    )
    .default([]),
});
export type CreateCourseInput = z.infer<typeof CreateCourseInputSchema>;

/**
 * Create a course in draft. `publishCourse` flips status to `published`.
 *
 * @throws ZodError if meta is malformed.
 * @throws Error if slug already exists.
 */
export async function createCourse(
  input: CreateCourseInput,
  store: CourseStore,
  now: () => string = isoNow,
): Promise<Course> {
  const parsed = CreateCourseInputSchema.parse(input);

  // Slug uniqueness is a soft invariant — the DB unique index is the source of
  // truth — but we surface a friendly error here before the round-trip.
  const existing = await store.getCourseBySlug(parsed.meta.slug);
  if (existing) {
    throw new Error(`Course with slug "${parsed.meta.slug}" already exists`);
  }

  // Paid courses MUST have a price.
  if (parsed.meta.tier === "paid") {
    if (!parsed.meta.price_cents || parsed.meta.price_cents <= 0) {
      throw new Error("paid courses require a positive price_cents");
    }
  }

  const courseId = `crs_${ulid()}`;
  const ts = now();
  const course: Course = {
    id: courseId,
    ...parsed.meta,
    status: "draft",
    version: 1,
    created_at: ts,
    updated_at: ts,
    archived_at: null,
  };

  await store.insertCourse(course);

  if (parsed.modules.length > 0) {
    const modules: Module[] = [];
    const lessons: Lesson[] = [];
    for (const m of parsed.modules) {
      const modId = `mod_${ulid()}`;
      modules.push({
        id: modId,
        course_id: courseId,
        title: m.title,
        description: m.description,
        order: m.order,
        created_at: ts,
        updated_at: ts,
      });
      for (const l of m.lessons) {
        lessons.push({
          id: `les_${ulid()}`,
          course_id: courseId,
          module_id: modId,
          title: l.title,
          order: l.order,
          body: l.body,
          required: l.required,
          created_at: ts,
          updated_at: ts,
        });
      }
    }
    await store.insertModules(modules);
    if (lessons.length > 0) {
      await store.insertLessons(lessons);
    }
  }

  return course;
}

const UpdateCourseInputSchema = CourseMetaSchema.partial().extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
});
export type UpdateCourseInput = z.infer<typeof UpdateCourseInputSchema>;

/** Patch course metadata. Bumps `version` on every mutation. */
export async function updateCourse(
  id: string,
  patch: UpdateCourseInput,
  store: CourseStore,
  now: () => string = isoNow,
): Promise<Course> {
  const parsed = UpdateCourseInputSchema.parse(patch);
  const existing = await store.getCourse(id);
  if (!existing) throw new Error(`Course ${id} not found`);

  const next: Course = {
    ...existing,
    ...parsed,
    version: existing.version + 1,
    updated_at: now(),
  };
  return store.updateCourse(id, next);
}

export async function archiveCourse(
  id: string,
  store: CourseStore,
  now: () => string = isoNow,
): Promise<Course> {
  const ts = now();
  return store.updateCourse(id, {
    status: "archived",
    archived_at: ts,
    updated_at: ts,
  });
}

export async function publishCourse(
  id: string,
  store: CourseStore,
  now: () => string = isoNow,
): Promise<Course> {
  const existing = await store.getCourse(id);
  if (!existing) throw new Error(`Course ${id} not found`);

  // Publish-time invariants: must have at least one lesson.
  const lessons = await store.listLessonsByCourse(id);
  if (lessons.length === 0) {
    throw new Error("Cannot publish a course with zero lessons");
  }

  return store.updateCourse(id, {
    status: "published",
    updated_at: now(),
  });
}

/**
 * Catalog list — pre-filters to published by default. Pagination via
 * `limit`/`offset`; the store is expected to apply ordering on
 * `created_at DESC`.
 */
export async function listCourses(
  store: CourseStore,
  filter: ListCoursesFilter = {},
): Promise<Course[]> {
  // Tier validation — accept "all" wildcard or one of the enum values.
  if (filter.tier && filter.tier !== "all" && !COURSE_TIERS.includes(filter.tier)) {
    throw new Error(`Invalid tier filter: ${filter.tier}`);
  }
  if (
    filter.industry &&
    filter.industry !== "all" &&
    !INDUSTRY_VERTICALS.includes(filter.industry)
  ) {
    throw new Error(`Invalid industry filter: ${filter.industry}`);
  }
  return store.listCourses({
    status: filter.status ?? "published",
    ...filter,
  });
}

export async function getCourse(
  id: string,
  store: CourseStore,
): Promise<{
  course: Course;
  modules: Module[];
  lessons: Lesson[];
} | null> {
  const course = await store.getCourse(id);
  if (!course) return null;
  const [modules, lessons] = await Promise.all([
    store.listModulesByCourse(id),
    store.listLessonsByCourse(id),
  ]);
  modules.sort((a, b) => a.order - b.order);
  lessons.sort((a, b) => a.order - b.order);
  return { course, modules, lessons };
}

/* ===== Helpers ========================================================= */

function isoNow(): string {
  return new Date().toISOString();
}

export { CreateCourseInputSchema, UpdateCourseInputSchema };
