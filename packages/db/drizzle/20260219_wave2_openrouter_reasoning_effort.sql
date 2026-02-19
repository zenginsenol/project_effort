-- Wave-2 forward migration
-- Purpose: add openrouter provider support and reasoning effort metadata

BEGIN;

-- 1) Extend provider enum for new AI provider
ALTER TYPE ai_provider ADD VALUE IF NOT EXISTS 'openrouter';

-- 2) Add reasoning effort metadata column for model-level tuning
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS reasoning_effort text;

-- 3) Enforce allowed reasoning effort values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_api_keys_reasoning_effort'
  ) THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT chk_api_keys_reasoning_effort
      CHECK (
        reasoning_effort IS NULL
        OR reasoning_effort IN ('low', 'medium', 'high', 'xhigh')
      );
  END IF;
END
$$;

COMMIT;
