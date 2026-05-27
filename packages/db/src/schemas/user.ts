import { z } from "zod";
import { id, isoDateTime, isoDateTimeNullable, jsonArray } from "./common.js";

export const UserStatusSchema = z.enum(["active", "deactivated", "deleted"]);

export const UserSchema = z.object({
  id: id("user"),
  email: z.string().email().max(320),
  emailNormalized: z.string().email().max(320).nullable(),
  emailVerifiedAt: isoDateTimeNullable,
  fullName: z.string().max(200).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  locale: z.string().max(35).default("en-US"),
  timezone: z.string().max(64).default("UTC"),
  passwordHash: z.string().max(512).nullable().optional(),
  passwordChangedAt: isoDateTimeNullable,
  mfaEnrolled: z.boolean().default(false),
  mfaFactors: jsonArray.default([]),
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
  fullName: true,
  locale: true,
  timezone: true,
  isInternal: true,
}).extend({
  passwordHash: z.string().max(512).optional(),
});

export const UpdateUserSchema = UserSchema.pick({
  email: true,
  fullName: true,
  avatarUrl: true,
  locale: true,
  timezone: true,
  mfaEnrolled: true,
  mfaFactors: true,
  status: true,
})
  .partial();

export type User = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
