# Kanban Self-Management Report (Full Flow)

Generated: 2026-02-20T07:44:29.783Z
Branch: `main`
Commit: `e7213f7`
Result summary: pass=8, warn=1, skip=1, fail=0

## Workspace Context

- Organization: `8976700f-b00f-496c-8b8c-44e58bc58250`
- User: `user_demo_001`
- Project: `1817d63e-ffcb-4b77-82c9-1f9c171f9a48`
- Created project in this run: yes
- Hourly rate: 1200
- Contingency: 20%
- Work hours/day: 8
- Active providers: openai
- Baseline analysis id: 55e15e74-303d-4f2a-8c27-763cfec142fd
- Variant analysis id: 2287e2c6-b433-4732-b58f-0c1f2fb650e7

## Step Results

| Step | Status | Duration(ms) | Detail |
|---|---|---|---|
| 1. Docs Bootstrap -> Kanban import | pass | 366 | - Kanban: pushed (inserted 55/55, deduped 0) |
| 2. Effort Calculate | pass | 4 | tasks=55, totalHours=675.6, cost=810720 |
| 3. Roadmap Generate | pass | 3 | phases=16, weeks=17 |
| 4. Apply Roadmap to Kanban | pass | 40 | updated=50, movedTodo=3, movedBacklog=47 |
| 5. Save Baseline Cost Analysis | pass | 8 | analysisId=55e15e74-303d-4f2a-8c27-763cfec142fd |
| 6. Save Variant Cost Analysis | pass | 5 | analysisId=2287e2c6-b433-4732-b58f-0c1f2fb650e7 |
| 7. Compare Baseline vs Variant | pass | 3 | rows=2, baseline=Kanban Workspace Baseline |
| 8. Export Baseline (json/csv/md) | pass | 8 | json=23694B, csv=4958B, md=4899B |
| 9. GitHub Sync (optional) | skip | 4 | GitHub integration is not connected |
| 10-openai. AI Analysis (openai) | warn | 2606 | Rate limit exceeded: Your openai API key has hit its rate limit. Please try again later. |

## Kanban + Effort Summary

- Total tasks: 55
- Total estimated hours: 563h
- Total estimated points: 142
- Development cost (rate based): 810720 TRY
- Roadmap: 16 phase(s), 17 week(s)

| Status | Tasks | Hours | Points |
|---|---|---|---|
| backlog | 52 | 528 | 133 |
| todo | 3 | 35 | 9 |
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

