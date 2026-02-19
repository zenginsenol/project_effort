# Cost Workflow Check

Generated: 2026-02-19T23:33:57.969Z
Project: `cbf9557d-badf-4bce-81d4-d0e3291371f9`
Org: `8976700f-b00f-496c-8b8c-44e58bc58250`
User: `user_demo_001`
Active providers: openai
Result summary: pass=8, warn=1, skip=0, fail=0

## Step Results

| Step | Name | Status | Detail |
|---|---|---|---|
| 1 | Effort Calculate | pass | tasks=80, totalHours=3801.6, totalCost=570240 |
| 2 | Roadmap Generate | pass | phases=52, totalWeeks=96 |
| 3 | Save Baseline Analysis | pass | analysisId=7a1ceaa6-e34d-4a09-8cd3-a3dc146503cc |
| 4 | Save Variant Analysis | pass | analysisId=7ef9922d-7112-42d1-bb7f-3193bb447ac7 |
| 5 | List Analyses | pass | listCount=2 |
| 6 | Update Analysis | pass | updatedFirstYearTotal=899040 |
| 7 | Compare Analyses | pass | rows=2, baseline=Workflow Check Baseline Updated |
| 8 | Export Analysis (json/csv/md) | pass | json=33523B, csv=6057B, md=5939B |
| 9-openai | AI Analysis (openai) | warn | Rate limit exceeded: Your openai API key has hit its rate limit. Please try again later. |

## Process Checklist

1. Effort calculation
2. Roadmap generation
3. Baseline + variant analysis save
4. Analysis update
5. Analysis compare
6. Export formats
7. AI analysis with active settings profile (provider/model/effort)

