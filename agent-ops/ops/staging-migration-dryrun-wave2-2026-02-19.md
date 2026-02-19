# Wave-2 Staging Migration Dry-Run Evidence

Date: 2026-02-19
Task: `H-004`
Database: `estimatepro_wave2_dryrun` (cloned from `estimatepro`)
Container: `estimatepro-postgres`

## Commands Executed

1. Clone source DB into dry-run DB:
   - `CREATE DATABASE estimatepro_wave2_dryrun TEMPLATE estimatepro;`
2. Apply forward SQL:
   - `packages/db/drizzle/20260219_wave2_openrouter_reasoning_effort.sql`
3. Validate post-forward state.
4. Apply rollback SQL:
   - `packages/db/drizzle/20260219_wave2_openrouter_reasoning_effort.rollback.sql`
5. Validate post-rollback state.

## Result Summary

- Forward migration: ✅ success
- Rollback migration: ✅ success
- Baseline snapshot already had `openrouter` enum value and `reasoning_effort` column.
- Forward script executed safely in idempotent mode (`IF NOT EXISTS`) and added missing check constraint.
- Constraint `chk_api_keys_reasoning_effort`: appears after forward, removed after rollback ✅
- Rollback script restored baseline without `openrouter` and without `reasoning_effort` in dry-run DB ✅

## Evidence Files

- `agent-ops/ops/evidence/wave2_dryrun_pre.txt`
- `agent-ops/ops/evidence/wave2_dryrun_post_forward.txt`
- `agent-ops/ops/evidence/wave2_dryrun_post_rollback.txt`
