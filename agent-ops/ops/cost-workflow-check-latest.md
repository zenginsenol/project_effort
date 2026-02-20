# Cost Workflow Check

Generated: 2026-02-20T07:37:24.646Z
Project: `cbf9557d-badf-4bce-81d4-d0e3291371f9`
Org: `8976700f-b00f-496c-8b8c-44e58bc58250`
User: `user_demo_001`
Active providers: openai
Result summary: pass=8, warn=1, skip=1, fail=0

## Step Results

| Step | Name | Status | Detail |
|---|---|---|---|
| 1 | Effort Calculate | pass | tasks=194, totalHours=7178.4, totalCost=1076760 |
| 2 | Roadmap Generate | pass | phases=96, totalWeeks=180 |
| 3 | Save Baseline Analysis | pass | analysisId=52cac163-4b66-429b-af88-3ca773e19b38 |
| 4 | Save Variant Analysis | pass | analysisId=cae5252d-1b6b-4b6f-86e0-dcf1dc72a72b |
| 5 | List Analyses | pass | listCount=2 |
| 6 | Update Analysis | pass | updatedFirstYearTotal=1405560 |
| 7 | Compare Analyses | pass | rows=2, baseline=Workflow Check Baseline Updated |
| 8 | Export Analysis (json/csv/md) | pass | json=78516B, csv=15226B, md=14812B |
| 9 | GitHub Sync (optional) | skip | GitHub integration is not connected |
| 10-openai | AI Analysis (openai) | warn | Rate limit exceeded: Your openai API key has hit its rate limit. Please try again later. |

## Process Checklist

1. Effort calculation
2. Roadmap generation
3. Baseline + variant analysis save
4. Analysis update
5. Analysis compare
6. Export formats
7. GitHub sync (optional, requires active integration + linked repo)
8. AI analysis with active settings profile (provider/model/effort)

