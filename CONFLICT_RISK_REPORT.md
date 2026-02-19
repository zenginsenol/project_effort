# Conflict Risk Report

Updated: 2026-02-19T12:54:00Z
Scope: Parallel in-progress changes across OAuth, provider schema, document analysis, and web settings/compare flow.
Source snapshot: `pnpm ops:conflicts` + `agent-ops/ops/conflict-hotspots-latest.md`

## P0 - Critical

1. OAuth callback architecture convergence
- Files:
  - `apps/api/src/routers/api-keys/router.ts`
  - `apps/api/src/routers/api-keys/schema.ts`
- Risk: Router/schema convergence is still pending; partial merge can break login initiation flow.
- Mandatory control:
  - Keep existing OpenAI auth callback support intact during merge.
  - Merge in order: `api-keys schema` -> `api-keys router`.

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

4. Mitigations completed (already pushed)
- `a205349`: backward-compatible dual-mode OAuth helpers + regression tests.
- `8dc2ff1`: callback credential-upsert refactor (`oauth-credential-store`) in API callback path.
