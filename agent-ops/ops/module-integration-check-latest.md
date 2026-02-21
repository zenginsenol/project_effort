# Module Integration Check

Updated: 2026-02-21T04:53:11.735Z
Branch: `main`
Working tree: tracked=30, untracked=2, total=32
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

