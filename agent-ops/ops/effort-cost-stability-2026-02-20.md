# Effort & Cost Stability Update (7-Item Closure)

Date: 2026-02-20

## Scope

1. Effort/Cost page freeze-loop investigation and fix
2. Provider determinism hardening for analyzer/document flow
3. E2E gate stabilization inside root quality gate
4. Regression verification for cost workflow

## Implemented Fixes

1. Effort page auto-apply loop was stabilized.
   - File: `apps/web/src/app/dashboard/effort/page.tsx`
   - Changes:
     - Prevented auto-retry loop after failed `applyRoadmap` (signature remains locked until manual retry).
     - Added guard for empty roadmap (`roadmapData.phases.length === 0`).
     - Narrowed effect dependencies to avoid mutation object churn.

2. Analyzer/provider selection and upload path were aligned.
   - File: `apps/web/src/app/dashboard/analyzer/page.tsx`
   - Changes:
     - Added active-provider aware selector.
     - Ensured text/file analysis requests include selected provider.

3. Document router provider resolution became deterministic.
   - File: `apps/api/src/routers/document/router.ts`
   - Changes:
     - Replaced unordered key selection with `findFirst + orderBy(updatedAt desc)`.

4. Tenant-provider guard tests were updated to the new query path.
   - File: `apps/api/src/routers/document/__tests__/tenant-provider-override.test.ts`

5. E2E quality gate reliability was fixed.
   - Files:
     - `scripts/quality-gate.mjs` (added `test:e2e` stage)
     - `apps/web/playwright.config.ts` (isolated host/port + disabled server reuse)
     - `apps/web/e2e/critical-flows.spec.ts` (updated headings + effort route assertion)

## 7-Item Closure Status (Cost Workflow)

Latest report: `agent-ops/ops/cost-workflow-check-latest.md`

1. Effort calculation -> pass
2. Roadmap generation -> pass
3. Baseline + variant save -> pass
4. Analysis update -> pass
5. Analysis compare -> pass
6. Export formats -> pass
7. GitHub sync -> skip (integration not connected in current workspace)

Additional:
- AI analysis step -> warn (real provider quota/rate-limit response; no mock fallback)

## Validation Commands

1. `pnpm --filter @estimate-pro/web test:e2e` -> pass (`6/6`)
2. `pnpm --filter @estimate-pro/api test` -> pass (`10 files / 38 tests`)
3. `pnpm quality:gate` -> pass (build + lint + typecheck + test + test:e2e)
4. `pnpm ops:effort:workflow:check` -> pass=8, warn=1, skip=1, fail=0

## Result

Effort/Cost page no longer gets stuck on auto-apply behavior and the workflow is stable under the quality gate. Remaining non-pass statuses are operational prerequisites (GitHub integration connected state) and external AI quota.
