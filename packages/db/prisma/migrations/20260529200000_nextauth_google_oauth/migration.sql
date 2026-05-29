-- ---------------------------------------------------------------------
-- NextAuth (Auth.js v5) Google OAuth migration.
--
-- 1. Adds the @auth/prisma-adapter standard columns to "users"
--    (name, email_verified, image). Backfills from legacy columns
--    (full_name, avatar_url, email_verified_at) when present.
-- 2. Drops legacy Clerk + password/MFA columns we no longer use.
-- 3. Creates the canonical accounts, auth_sessions, verification_tokens
--    tables expected by the adapter.
--
-- Safe to run on a fresh DB or one that has the prior Clerk era — every
-- statement is guarded with IF EXISTS / IF NOT EXISTS.
-- ---------------------------------------------------------------------

-- ---- USERS ----------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "name"           TEXT,
  ADD COLUMN IF NOT EXISTS "image"          TEXT,
  ADD COLUMN IF NOT EXISTS "email_verified" TIMESTAMPTZ(6);

-- Backfill from prior column names where they exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'full_name'
  ) THEN
    EXECUTE 'UPDATE "users" SET "name" = COALESCE("name", "full_name")';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    EXECUTE 'UPDATE "users" SET "image" = COALESCE("image", "avatar_url")';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified_at'
  ) THEN
    EXECUTE 'UPDATE "users" SET "email_verified" = COALESCE("email_verified", "email_verified_at")';
  END IF;
END$$;

-- Make email globally unique (NextAuth requirement). Drop legacy
-- email-normalized unique index first if present.
DROP INDEX IF EXISTS "users_email_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" ("email");

-- Drop legacy / Clerk-era columns we no longer maintain.
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "clerk_id",
  DROP COLUMN IF EXISTS "full_name",
  DROP COLUMN IF EXISTS "avatar_url",
  DROP COLUMN IF EXISTS "email_verified_at",
  DROP COLUMN IF EXISTS "password_hash",
  DROP COLUMN IF EXISTS "password_changed_at",
  DROP COLUMN IF EXISTS "mfa_enrolled",
  DROP COLUMN IF EXISTS "mfa_factors";

DROP INDEX IF EXISTS "users_clerk_id_key";
DROP INDEX IF EXISTS "users_clerk_id_idx";

-- ---- ACCOUNTS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "accounts" (
  "id"                  TEXT PRIMARY KEY
                        DEFAULT ('act_' || encode(gen_random_bytes(13), 'hex')),
  "userId"              TEXT NOT NULL,
  "type"                TEXT NOT NULL,
  "provider"            TEXT NOT NULL,
  "providerAccountId"   TEXT NOT NULL,
  "refresh_token"       TEXT,
  "access_token"        TEXT,
  "expires_at"          INTEGER,
  "token_type"          TEXT,
  "scope"               TEXT,
  "id_token"            TEXT,
  "session_state"       TEXT,
  CONSTRAINT "accounts_user_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_account_key"
  ON "accounts" ("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" ("userId");

-- ---- AUTH_SESSIONS --------------------------------------------------
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id"            TEXT PRIMARY KEY
                  DEFAULT ('ass_' || encode(gen_random_bytes(13), 'hex')),
  "sessionToken"  TEXT NOT NULL UNIQUE,
  "userId"        TEXT NOT NULL,
  "expires"       TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "auth_sessions_user_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "auth_sessions" ("userId");

-- ---- VERIFICATION_TOKENS --------------------------------------------
CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expires"    TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_token_key"
  ON "verification_tokens" ("token");

-- ---- RLS exemption --------------------------------------------------
-- The adapter tables are user-scoped (not workspace-scoped). They sit
-- outside the workspace RLS model — access is controlled by the
-- application layer via the session token check.
ALTER TABLE IF EXISTS "accounts"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "auth_sessions"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "verification_tokens" DISABLE ROW LEVEL SECURITY;
