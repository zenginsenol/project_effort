# Go-Live Flow Runner Report

Generated: 2026-02-20T05:03:51.987Z
Branch: `main`
Commit: `b1b4dce`

## Execution Context

- withTransfer: true
- projectId: cbf9557d-badf-4bce-81d4-d0e3291371f9
- GITHUB_REPO: set
- GITHUB_TOKEN: set
- KANBAN_PROJECT_ID: set

## Step Results

| Step | Status | Duration(ms) | Command | Exit |
|---|---|---|---|---|
| 1. Docs Bootstrap | pass | 1007 | `pnpm ops:bootstrap:docs` | 0 |
| 2. Integration Contracts | pass | 439 | `pnpm ops:integration:check` | 0 |
| 3. Effort Workflow Check | pass | 4454 | `pnpm ops:effort:workflow:check` | 0 |
| 4. Unified Roadmap | pass | 439 | `pnpm ops:flow:roadmap` | 0 |
| 5. Push GitHub + Kanban | pass | 25257 | `pnpm ops:bootstrap:docs:push -- --project-id cbf9557d-badf-4bce-81d4-d0e3291371f9` | 0 |
| 6. Unified Roadmap (post-transfer) | pass | 445 | `pnpm ops:flow:roadmap` | 0 |

## Transfer Decision

- status: executed
- detail: Transfer command executed successfully

## Consolidated Gates (from effort-flow-roadmap)

| Gate | Status | Evidence |
|---|---|---|
| Docs -> COS extraction | pass | tasks=93, effort=1269.6h |
| Effort/Cost workflow | pass | pass=8, warn=2, skip=1, fail=0 |
| Module contracts | pass | 4/4 passed |
| GitHub + Kanban transfer readiness | pass | github=pushed, kanban=pushed |
| AI provider health | warn | warn: Rate limit exceeded: Your openai API key has hit its rate limit. Please try again later. |

## Next Action Rules

1. Any `fail` step blocks go-live.
2. `warn` gate on transfer means GitHub/Kanban envs or integration linkage missing.
3. `warn` gate on AI provider health means provider quota/rate-limit; integration code path still valid.

