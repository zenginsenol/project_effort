# Kanban Self-Management Report

Generated: 2026-02-20T02:33:37.866Z
Branch: `main`
Commit: `92d97d3`

## Workspace Context

- Organization: `8976700f-b00f-496c-8b8c-44e58bc58250`
- User: `user_demo_001`
- Project: `64b148ef-5946-4fa8-9c52-f90facd09462`
- Created project in this run: no
- Hourly rate: 1200
- Contingency: 20%
- Work hours/day: 8

## Step Results

| Step | Status | Duration(ms) | Detail |
|---|---|---|---|
| 1. Docs Bootstrap -> Kanban import | pass | 382 | - Kanban: pushed (inserted 0/93, deduped 93) |
| 2. Effort Calculate | pass | 8 | tasks=93, totalHours=1269.6, cost=1523520 |
| 3. Roadmap Generate | pass | 4 | phases=28, weeks=32 |
| 4. Apply Roadmap to Kanban | pass | 109 | updated=86, movedTodo=3, movedBacklog=83 |
| 5. Save Baseline Cost Analysis | pass | 11 | analysisId=4571ed80-8da3-41d8-9c1f-39aa1496b02b |

## Kanban + Effort Summary

- Total tasks: 93
- Total estimated hours: 1058h
- Total estimated points: 268
- Development cost (rate based): 1523520 TRY
- Roadmap: 28 phase(s), 32 week(s)

| Status | Tasks | Hours | Points |
|---|---|---|---|
| backlog | 90 | 1020 | 258.5 |
| todo | 3 | 38 | 9.5 |
| in_progress | 0 | 0 | 0 |
| in_review | 0 | 0 | 0 |
| done | 0 | 0 | 0 |
| cancelled | 0 | 0 | 0 |

## How To Use

1. Open `/dashboard/projects/<PROJECT_ID>?view=board` for Kanban execution.
2. Open `/dashboard/effort` and select the same project for cost/compare/export workflows.
3. Re-run this script whenever kickoff docs change to refresh backlog + effort baseline.

