-- Add Clerk-issued user id to our local users table so the webhook + the
-- request-time bridge in `apps/web/src/lib/auth/current-user.ts` can resolve
-- the local User row from the Clerk session.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "clerk_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_key"
  ON "users" ("clerk_id")
  WHERE "clerk_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "users_clerk_id_idx"
  ON "users" ("clerk_id");
