# Kanban Self-Management Report (Full Flow)

Generated: 2026-02-20T03:09:28.659Z
Branch: `main`
Commit: `0699bca`
Result summary: pass=8, warn=0, skip=2, fail=0

## Workspace Context

- Organization: `8976700f-b00f-496c-8b8c-44e58bc58250`
- User: `user_demo_001`
- Project: `64b148ef-5946-4fa8-9c52-f90facd09462`
- Created project in this run: no
- Hourly rate: 1200
- Contingency: 20%
- Work hours/day: 8
- Active providers: openai
- Baseline analysis id: 17fd608e-d11c-41af-b86b-573c8577073c
- Variant analysis id: 91474565-4b2a-4a21-9cb2-cac3e7a99269

## Step Results

| Step | Status | Duration(ms) | Detail |
|---|---|---|---|
| 1. Docs Bootstrap -> Kanban import | pass | 389 | - Kanban: pushed (inserted 0/93, deduped 93) |
| 2. Effort Calculate | pass | 7 | tasks=93, totalHours=1269.6, cost=1523520 |
| 3. Roadmap Generate | pass | 4 | phases=28, weeks=32 |
| 4. Apply Roadmap to Kanban | pass | 3 | updated=0, movedTodo=0, movedBacklog=0 |
| 5. Save Baseline Cost Analysis | pass | 11 | analysisId=17fd608e-d11c-41af-b86b-573c8577073c |
| 6. Save Variant Cost Analysis | pass | 7 | analysisId=91474565-4b2a-4a21-9cb2-cac3e7a99269 |
| 7. Compare Baseline vs Variant | pass | 14 | rows=2, baseline=Kanban Workspace Baseline |
| 8. Export Baseline (json/csv/md) | pass | 8 | json=39787B, csv=8170B, md=8013B |
| 9. GitHub Sync (optional) | skip | 0 | Skipped by --skip-github-sync |
| 10. AI Analysis (optional) | skip | 0 | Skipped by --skip-ai |

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

## Full-Flow Checklist

1. Docs -> Kanban import
2. Effort calculate + roadmap generate + apply
3. Baseline + variant analysis save
4. Compare analyses
5. Export analysis (json/csv/md)
6. GitHub sync (optional)
7. AI analysis (optional per active provider)

## How To Use

1. Open `/dashboard/projects/<PROJECT_ID>?view=board` for Kanban execution.
2. Open `/dashboard/effort` and select the same project for compare/export/sync workflows.
3. Re-run this command after doc changes: `pnpm ops:kanban:self-manage`.
4. Optional flags: `--skip-ai`, `--skip-github-sync`, `--project-id <id>`.

