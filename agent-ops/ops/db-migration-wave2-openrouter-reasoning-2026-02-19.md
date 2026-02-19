# Wave-2 DB Migration Plan: openrouter + reasoning effort

Date: 2026-02-19
Owner: Agent-B / Ops
Task: `H-003`

## Scope

- Expand enum `ai_provider` with `openrouter`
- Add `api_keys.reasoning_effort` for model reasoning controls
- Enforce reasoning values with DB constraint

## Forward SQL

- `packages/db/drizzle/20260219_wave2_openrouter_reasoning_effort.sql`

Forward operations:
1. `ALTER TYPE ai_provider ADD VALUE IF NOT EXISTS 'openrouter'`
2. `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS reasoning_effort text`
3. Add check constraint `chk_api_keys_reasoning_effort` allowing `low|medium|high|xhigh`

## Rollback SQL

- `packages/db/drizzle/20260219_wave2_openrouter_reasoning_effort.rollback.sql`

Rollback operations:
1. Block rollback if any `provider='openrouter'` rows exist
2. Drop `reasoning_effort` column + check constraint
3. Recreate `ai_provider` enum without `openrouter` and cast provider column

## Pre-Deploy Checks

1. Confirm backup snapshot exists for production DB.
2. Confirm migration window includes enum-change lock tolerance.
3. Confirm no long-running transactions on `api_keys`.

## Post-Deploy Validation Queries

```sql
-- enum value presence
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'ai_provider'
ORDER BY e.enumsortorder;

-- column + constraint presence
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'api_keys' AND column_name = 'reasoning_effort';

SELECT conname
FROM pg_constraint
WHERE conname = 'chk_api_keys_reasoning_effort';
```

## Risk Notes

- Enum rollback is destructive and requires type recreation.
- Rollback must run only when no `openrouter` data exists.
- Application deploy and migration order must be coordinated to avoid enum mismatch.

