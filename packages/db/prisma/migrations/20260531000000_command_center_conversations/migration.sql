-- ============================================================================
-- 20260531000000_command_center_conversations
--
-- AI Command Center for GoFunnelAI (gofunnelai.com).
--
-- Persists the chat-first interaction surface in `/dashboard/command`. The
-- user types free-form prompts ("Create a launch campaign for my dental
-- funnel targeting practice managers, goal: booked demos") and the AI
-- orchestrator classifies intent then dispatches the right pipeline
-- (create_funnel, create_campaign, edit_funnel, edit_campaign, query,
-- launch, generic_question).
--
-- Tenancy:
--   * command_conversations carries workspace_id directly (RLS scoped).
--   * command_messages is RLS-scoped via conversation_id → conversations.
--
-- This migration is idempotent: every CREATE TYPE / TABLE / INDEX / POLICY
-- is guarded so re-running it is a no-op.
-- ============================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS (idempotent)
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "command_conversation_role" AS ENUM ('user','assistant','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. command_conversations  (root; carries workspace_id for RLS)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "command_conversations" (
  "id"             TEXT PRIMARY KEY DEFAULT ('ccv_' || encode(gen_random_bytes(13), 'hex')),
  "workspace_id"   TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id"        TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"          TEXT NOT NULL DEFAULT 'Untitled chat',
  "pinned_context" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "archived_at"    TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS "command_conv_workspace_updated_idx"
  ON "command_conversations" ("workspace_id","updated_at" DESC);
CREATE INDEX IF NOT EXISTS "command_conv_user_idx"
  ON "command_conversations" ("user_id");

DO $$ BEGIN
  CREATE TRIGGER command_conversations_set_updated_at BEFORE UPDATE ON "command_conversations"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 3. command_messages  (child; isolated via conversation_id subquery)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "command_messages" (
  "id"              TEXT PRIMARY KEY DEFAULT ('cmg_' || encode(gen_random_bytes(13), 'hex')),
  "conversation_id" TEXT NOT NULL REFERENCES "command_conversations"("id") ON DELETE CASCADE,
  "role"            "command_conversation_role" NOT NULL,
  "content"         JSONB NOT NULL,
  "metadata"        JSONB,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "command_msg_conv_time_idx"
  ON "command_messages" ("conversation_id","created_at");

-- ---------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------

ALTER TABLE "command_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "command_conversations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "command_conversations_tenant_isolation" ON "command_conversations";
CREATE POLICY "command_conversations_tenant_isolation" ON "command_conversations"
  USING ("workspace_id" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "command_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "command_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "command_messages_tenant_isolation" ON "command_messages";
CREATE POLICY "command_messages_tenant_isolation" ON "command_messages"
  USING ("conversation_id" IN (
    SELECT "id" FROM "command_conversations"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ))
  WITH CHECK ("conversation_id" IN (
    SELECT "id" FROM "command_conversations"
    WHERE "workspace_id" = current_setting('app.workspace_id', true)
  ));
