# Cost Workflow Check

Generated: 2026-02-20T00:01:34.032Z
Project: `cbf9557d-badf-4bce-81d4-d0e3291371f9`
Org: `8976700f-b00f-496c-8b8c-44e58bc58250`
User: `user_demo_001`
Active providers: openai
Result summary: pass=8, warn=1, skip=1, fail=0

## Step Results

| Step | Name | Status | Detail |
|---|---|---|---|
| 1 | Effort Calculate | pass | tasks=80, totalHours=3801.6, totalCost=570240 |
| 2 | Roadmap Generate | pass | phases=52, totalWeeks=96 |
| 3 | Save Baseline Analysis | pass | analysisId=2f0108b9-5c0a-4da5-a254-783ac90b0779 |
| 4 | Save Variant Analysis | pass | analysisId=5252a62c-087f-4cff-acac-34632f01516d |
| 5 | List Analyses | pass | listCount=2 |
| 6 | Update Analysis | pass | updatedFirstYearTotal=899040 |
| 7 | Compare Analyses | pass | rows=2, baseline=Workflow Check Baseline Updated |
| 8 | Export Analysis (json/csv/md) | pass | json=33523B, csv=6057B, md=5939B |
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

