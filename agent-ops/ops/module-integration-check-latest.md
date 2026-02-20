# Module Integration Check

Updated: 2026-02-20T07:37:22.854Z
Branch: `main`
Working tree: tracked=16, untracked=8, total=24
Contract checks: 4/4 passed
Quality gate: not requested

## Contract Matrix

| Area | Status | Producer Missing | Consumer Missing | Bridge Missing |
|---|---|---|---|---|
| Effort <-> Kanban | pass | - | - | - |
| Project <-> GitHub Integration | pass | - | - | - |
| Settings <-> OAuth API callback | pass | - | - | - |
| Analyzer <-> Document API | pass | - | - | - |

## Next Actions

1. Resolve failing contract lines before merge.
2. Re-run `pnpm ops:integration:check` after each hotspot batch.
3. Run `pnpm ops:integration:gate` before production cutover.

