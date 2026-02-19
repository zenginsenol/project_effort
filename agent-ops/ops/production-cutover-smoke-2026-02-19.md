# Production Cutover Smoke Log (G-006)

Date: 2026-02-19  
Owner: Manager / Ops

## Cutover Execution Template

Use this log during real production cutover:

1. Deployment start time:
2. API version deployed:
3. Web version deployed:
4. Migration command and output:
5. Smoke checks:
   - [ ] `GET /health` returns 200
   - [ ] `/dashboard` loads
   - [ ] `/dashboard/projects` loads
   - [ ] `/dashboard/sessions` loads
   - [ ] `/dashboard/analyzer` loads
6. Monitoring status after 15 minutes:
7. Final go/no-go decision:

## Local Rehearsal Result

- Deployment gate (`pnpm quality:gate`) passed.
- E2E smoke and critical-flow suites passed (`pnpm --filter @estimate-pro/web test:e2e`, 5/5).
- API lint baseline re-verified (`pnpm --filter @estimate-pro/api lint`, 0 errors).
- Cutover script/order validated for operator readiness.

## Rehearsal Evidence (Captured)

1. `pnpm quality:gate` -> Passed (build + lint + typecheck + test)
2. `pnpm --filter @estimate-pro/web test:e2e` -> Passed (5 tests)
3. `pnpm --filter @estimate-pro/api lint` -> Passed with warnings only
4. `pnpm agent:status` -> `todo=0`, `in_progress=0`, `blocked=0`, `done=46`

## Status

Cutover procedure is execution-ready; run this checklist in production window for final sign-off.
