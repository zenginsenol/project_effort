# Go-Live Flow Runner Report

Generated: 2026-02-20T04:55:18.110Z
Branch: `main`
Commit: `812d0e3`

## Execution Context

- withTransfer: false
- projectId: -
- GITHUB_REPO: missing
- GITHUB_TOKEN: missing
- KANBAN_PROJECT_ID: missing

## Step Results

| Step | Status | Duration(ms) | Command | Exit |
|---|---|---|---|---|
| 1. Docs Bootstrap | pass | 997 | `pnpm ops:bootstrap:docs` | 0 |
| 2. Integration Contracts | pass | 437 | `pnpm ops:integration:check` | 0 |
| 3. Effort Workflow Check | pass | 5442 | `pnpm ops:effort:workflow:check` | 0 |
| 4. Unified Roadmap | pass | 441 | `pnpm ops:flow:roadmap` | 0 |

## Transfer Decision

- status: skipped
- detail: with-transfer flag not enabled

## Consolidated Gates (from effort-flow-roadmap)

| Gate | Status | Evidence |
|---|---|---|
| Docs -> COS extraction | pass | tasks=93, effort=1269.6h |
| Effort/Cost workflow | pass | pass=8, warn=1, skip=1, fail=0 |
| Module contracts | pass | 4/4 passed |
| GitHub + Kanban transfer readiness | warn | github=skipped, kanban=skipped |
| AI provider health | warn | warn: Rate limit exceeded: Your openai API key has hit its rate limit. Please try again later. |

## Next Action Rules

1. Any `fail` step blocks go-live.
2. `warn` gate on transfer means GitHub/Kanban envs or integration linkage missing.
3. `warn` gate on AI provider health means provider quota/rate-limit; integration code path still valid.

