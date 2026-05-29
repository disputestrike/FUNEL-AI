import { z } from "zod";
import { id, isoDateTime, isoDateTimeNullable } from "./common.js";

export const UserStatusSchema = z.enum(["active", "deactivated", "deleted"]);

/**
 * Zod schema for the User model. Aligned with the NextAuth /
 * @auth/prisma-adapter standard columns (name, email, emailVerified, image)
 * plus our GoFunnel extras (locale, timezone, status, lastLogin tracking).
 */
export const UserSchema = z.object({
  id: id("user"),
  name: z.string().max(200).nullable().optional(),
  email: z.string().email().max(320),
  emailVerified: isoDateTimeNullable,
  image: z.string().url().max(2048).nullable().optional(),
  emailNormalized: z.string().email().max(320).nullable().optional(),
  locale: z.string().max(35).default("en-US"),
  timezone: z.string().max(64).default("UTC"),
  lastLoginAt: isoDateTimeNullable,
  lastLoginIpHash: z.string().max(128).nullable().optional(),
  status: UserStatusSchema.default("active"),
  isInternal: z.boolean().default(false),
  deactivatedAt: isoDateTimeNullable,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTimeNullable,
});

export const CreateUserSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
  image: true,
  locale: true,
  timezone: true,
  isInternal: true,
});

export const UpdateUserSchema = UserSchema.pick({
  email: true,
  name: true,
  image: true,
  locale: true,
  timezone: true,
  status: true,
}).partial();

export type User = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
