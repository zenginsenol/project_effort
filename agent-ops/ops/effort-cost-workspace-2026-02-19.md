# Effort/Cost Workspace Rollout - 2026-02-19

## Goal

Turn effort-cost calculation into a full usage workflow:
1. Save analysis snapshots.
2. Regenerate with AI providers (OpenAI / Claude / OpenRouter).
3. Edit analysis sections later.
4. Compare analyses in a dedicated compare block.
5. Export analyses.
6. Sync analyses to GitHub as traceable issues.

## Delivery Map

### 1) Database

Files:
- `packages/db/src/schema/cost-analyses.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/relations.ts`
- `packages/db/drizzle/20260219_wave3_cost_analysis_workspace.sql`
- `packages/db/drizzle/20260219_wave3_cost_analysis_workspace.rollback.sql`

Added data model:
1. Snapshot metadata (`name`, `description`, source/provider/model/reasoning).
2. Calculation inputs + editable operational sections.
3. Snapshot outputs (`taskSnapshot`, `summarySnapshot`, `breakdownSnapshot`).
4. GitHub sync metadata (`integrationId`, repository, issue no/url, syncedAt).

### 2) API

Files:
- `apps/api/src/routers/effort/cost-analysis-service.ts`
- `apps/api/src/routers/effort/schema.ts`
- `apps/api/src/routers/effort/router.ts`

New endpoints:
1. `effort.listAnalyses`
2. `effort.getAnalysis`
3. `effort.saveCurrentAnalysis`
4. `effort.createAiAnalysis`
5. `effort.updateAnalysis`
6. `effort.deleteAnalysis`
7. `effort.compareAnalyses`
8. `effort.exportAnalysis`
9. `effort.syncAnalysisToGithub`

Operational details:
1. AI analysis resolves user provider credentials and supports OAuth refresh path.
2. Cost model computes development + first-year operations totals.
3. GitHub sync upserts issue (existing synced issue updated; otherwise created).
4. Export supports `json`, `csv`, `md`.

### 3) Web UX

File:
- `apps/web/src/app/dashboard/effort/page.tsx`

New workspace sections:
1. Snapshot save/edit/delete panel.
2. AI generation panel with provider/model/reasoning/context input.
3. Editable additional cost lines.
4. Saved analyses table with compare-selection.
5. Compare results matrix (baseline delta).
6. Export + GitHub sync controls.

## Usage Sequence

1. Select project in effort page.
2. Set baseline parameters and save current snapshot.
3. Generate one or more AI analyses from scope text (provider-specific).
4. Edit assumptions + additional operational costs.
5. Mark analyses for compare and inspect delta table.
6. Export selected analysis (`JSON/CSV/MD`).
7. Sync selected analysis to linked GitHub repository.

## Validation

Executed checks:
1. `pnpm --filter @estimate-pro/db build`
2. `pnpm --filter @estimate-pro/db typecheck`
3. `pnpm --filter @estimate-pro/api typecheck`
4. `pnpm --filter @estimate-pro/api lint`
5. `pnpm --filter @estimate-pro/web typecheck`
6. `pnpm --filter @estimate-pro/web lint`

Result:
- Typecheck gates passed.
- Lint gates passed with existing unrelated warnings.

## Process Validation Commands

Automated workflow validation:
1. `pnpm ops:effort:workflow:check`
2. Output report: `agent-ops/ops/cost-workflow-check-latest.md`
3. Unified roadmap + gate report: `pnpm ops:flow:roadmap`
4. Unified output: `agent-ops/ops/effort-flow-roadmap-latest.md`
5. Single-command flow runner: `pnpm ops:flow:run`
6. Runner output: `agent-ops/ops/go-live-flow-runner-latest.md`
7. Internal kanban + effort management: `pnpm ops:kanban:self-manage`
8. Internal kanban output: `agent-ops/ops/kanban-self-manage-latest.md`
9. Internal kanban command now includes compare/export + optional github/ai checks.
10. Deterministic core flow: `pnpm ops:kanban:self-manage -- --skip-ai --skip-github-sync`
11. Core flow shortcut: `pnpm ops:kanban:self-manage:core`

Step-by-step validation runbook:
1. `agent-ops/ops/cost-effort-process-validation-2026-02-19.md`
