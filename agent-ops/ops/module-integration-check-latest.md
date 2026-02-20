# Module Integration Check

Updated: 2026-02-20T03:25:07.778Z
Branch: `main`
Working tree: tracked=12, untracked=1, total=13
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

