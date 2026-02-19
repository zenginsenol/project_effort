-- Wave-2 rollback migration
-- NOTE: rolling back enum values in PostgreSQL requires type recreation.
-- This script is safe only if no row uses provider='openrouter'.

BEGIN;

-- 1) Ensure there is no openrouter data before enum rollback
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM api_keys WHERE provider::text = 'openrouter') THEN
    RAISE EXCEPTION 'Rollback blocked: api_keys has provider=openrouter rows';
  END IF;
END
$$;

-- 2) Remove reasoning effort constraint and column
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS chk_api_keys_reasoning_effort;
ALTER TABLE api_keys DROP COLUMN IF EXISTS reasoning_effort;

-- 3) Recreate ai_provider enum without openrouter
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider') THEN
    ALTER TYPE ai_provider RENAME TO ai_provider_old;
    CREATE TYPE ai_provider AS ENUM ('openai', 'anthropic');

    ALTER TABLE api_keys
      ALTER COLUMN provider TYPE ai_provider
      USING provider::text::ai_provider;

    DROP TYPE ai_provider_old;
  END IF;
END
$$;

COMMIT;
