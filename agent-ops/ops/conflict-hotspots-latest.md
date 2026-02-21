# Conflict Hotspots Report

Updated: 2026-02-20T23:32:52.435Z
Branch: `main`
Working tree: tracked=26, untracked=2, total=28

## Active Hotspots

### P0 - OAuth callback architecture convergence

Reason: Shared auth flow spans router, oauth service, and API callback route; partial merge can break login.
Safe merge order: 1) services/oauth 2) server callback route 3) api-keys router

| Status | File |
|---|---|
| `M` | `apps/api/src/server.ts` |
| `M` | `apps/api/src/services/oauth/claude-oauth.ts` |
| `M` | `apps/api/src/services/oauth/oauth-credential-store.ts` |

### P1 - Provider schema and DB alignment

Reason: Enum/column additions must stay aligned with router/input schemas and migrations.
Safe merge order: 1) DB migration SQL 2) schema enums/columns 3) API input/output schemas

| Status | File |
|---|---|
| `M` | `packages/db/src/schema/embeddings.ts` |

### P1 - Document analysis contract drift

Reason: Changes in extraction service and router schema can diverge and cause runtime parse errors.
Safe merge order: 1) document schema 2) extractor service 3) document router

| Status | File |
|---|---|
| `M` | `apps/api/src/routers/document/__tests__/tenant-provider-override.test.ts` |
| `M` | `apps/api/src/routers/document/router.ts` |
| `M` | `apps/api/src/services/document/task-extractor.ts` |

### P2 - Web settings/compare UX consistency

Reason: Navigation, compare page, and settings panel can drift from backend capabilities.
Safe merge order: 1) compare route 2) settings page 3) sidebar/nav links

| Status | File |
|---|---|
| `M` | `apps/web/src/app/dashboard/settings/page.tsx` |

## Unmapped Files

- `M` `PROJECT_TRACKER.md`
- `M` `agent-ops/ops/cost-workflow-check-latest.md`
- `M` `agent-ops/ops/go-live-wave2-status.md`
- `M` `agent-ops/ops/module-integration-check-latest.md`
- `M` `apps/api/src/routers/ai/router.ts`
- `M` `apps/api/src/routers/effort/cost-analysis-service.ts`
- `M` `apps/api/src/routers/integration/router.ts`
- `M` `apps/api/src/services/ai/similarity.ts`
- `M` `apps/api/src/trpc/context.ts`
- `M` `apps/web/e2e/critical-flows.spec.ts`
- `M` `apps/web/playwright.config.ts`
- `M` `apps/web/src/app/dashboard/analyzer/page.tsx`
- `M` `apps/web/src/app/dashboard/effort/page.tsx`
- `M` `apps/web/src/app/dashboard/integrations/page.tsx`
- `M` `apps/web/src/app/dashboard/projects/[projectId]/page.tsx`
- `M` `packages/estimation-core/src/tshirt-sizing.ts`
- `M` `packages/estimation-core/src/wideband-delphi.ts`
- `M` `scripts/quality-gate.mjs`
- `??` `agent-ops/ops/effort-cost-stability-2026-02-20.md`
- `??` `apps/api/src/trpc/__tests__/`

## Operator Notes

- Stage and commit only files for one hotspot at a time.
- Re-run `pnpm quality:gate` after each hotspot merge batch.
- Keep OpenAI OAuth auth path intact; do not remove existing callback support until dual-mode checks pass.

