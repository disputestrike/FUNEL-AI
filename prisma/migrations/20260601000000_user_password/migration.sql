-- ---------------------------------------------------------------------
-- Add email + password credentials to the users table.
--
-- The NextAuth Credentials provider needs a hashed password column on
-- users. OAuth-only accounts (Google) leave these NULL. password_hash is
-- a bcryptjs hash (cost 12); password_set_at records the most recent
-- hash write so we can surface "last changed" in account settings.
-- ---------------------------------------------------------------------

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash"   TEXT,
  ADD COLUMN IF NOT EXISTS "password_set_at" TIMESTAMPTZ(6);