# Conflict Risk Report

Updated: 2026-02-19T12:46:20Z
Scope: Parallel in-progress changes across OAuth, provider schema, document analysis, and web settings/compare flow.
Source snapshot: `pnpm ops:conflicts` + `agent-ops/ops/conflict-hotspots-latest.md`

## P0 - Critical

1. OAuth callback architecture convergence
- Files:
  - `apps/api/src/routers/api-keys/router.ts`
  - `apps/api/src/routers/api-keys/schema.ts`
  - `apps/api/src/server.ts`
  - `apps/api/src/services/oauth/openai-oauth.ts`
  - `apps/api/src/services/oauth/__tests__/openai-oauth.test.ts`
  - `apps/api/src/services/oauth/oauth-credential-store.ts` (new)
- Risk: Partial merge of router/service/server paths can break OAuth login and callback completion in deployed environments.
- Mandatory control:
  - Keep existing OpenAI auth callback support intact during merge.
  - Merge in order: `services/oauth` -> `server callback route` -> `api-keys router`.

## P1 - High

1. Provider schema and DB alignment
- Files:
  - `packages/db/src/schema/enums.ts`
  - `packages/db/src/schema/api-keys.ts`
  - `apps/api/src/routers/api-keys/schema.ts`
  - `apps/api/src/routers/api-keys/router.ts`
- Risk: Enum/column/API schema drift can cause runtime insert/update failures.
- Mandatory control:
  - Apply migration artifacts first, then schema and router/input updates.

2. Document analysis contract drift
- Files:
  - `apps/api/src/routers/document/router.ts`
  - `apps/api/src/routers/document/schema.ts`
  - `apps/api/src/services/document/task-extractor.ts`
- Risk: Input/response shape divergence can create parse/validation regressions.
- Mandatory control:
  - Merge schema -> service -> router and run API tests after each batch.

## P2 - Medium

1. Web settings/compare UX consistency
- Files:
  - `apps/web/src/app/dashboard/compare/page.tsx`
  - `apps/web/src/app/dashboard/settings/page.tsx`
  - `apps/web/src/components/layout/sidebar.tsx`
- Risk: Navigation/UI may expose routes not fully supported by backend contract.
- Mandatory control:
  - Merge compare route and settings contract together; verify sidebar links after backend readiness.

## Current Controls Applied

1. Conflict hotspot automation
- Command: `pnpm ops:conflicts`
- Output: `agent-ops/ops/conflict-hotspots-latest.md`
- Purpose: deterministic hotspot grouping + safe merge order.

2. Quality gate baseline
- `pnpm quality:gate` -> pass (build/lint/typecheck/test)
- Known state: warnings only, no gate-blocking errors.

3. Parallel-safe commit discipline
- Only single-hotspot staging is allowed.
- Do not include unrelated modified files in the same commit.
