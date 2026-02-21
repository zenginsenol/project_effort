# Cost Workflow Check

Generated: 2026-02-21T04:42:10.675Z
Project: `cbf9557d-badf-4bce-81d4-d0e3291371f9`
Org: `8976700f-b00f-496c-8b8c-44e58bc58250`
User: `user_demo_001`
Active providers: openai
Result summary: pass=9, warn=1, skip=0, fail=0

## Step Results

| Step | Name | Status | Detail |
|---|---|---|---|
| 1 | Effort Calculate | pass | tasks=194, totalHours=7178.4, totalCost=1076760 |
| 2 | Roadmap Generate | pass | phases=96, totalWeeks=180 |
| 3 | Save Baseline Analysis | pass | analysisId=e03b9dca-3267-4ee3-861f-1708b842bc86 |
| 4 | Save Variant Analysis | pass | analysisId=48843edb-cdb2-4164-91fd-90490cf47474 |
| 5 | List Analyses | pass | listCount=5 |
| 6 | Update Analysis | pass | updatedFirstYearTotal=1405560 |
| 7 | Compare Analyses | pass | rows=2, baseline=Workflow Check Baseline Updated |
| 8 | Export Analysis (json/csv/md) | pass | json=78516B, csv=15226B, md=14812B |
| 9 | GitHub Sync (optional) | pass | issue=https://github.com/elkekoitan/estimatepro-ecommerce-sync/issues/52 |
| 10-openai | AI Analysis (openai) | warn | AI analysis failed: terminated |

## Process Checklist

1. Effort calculation
2. Roadmap generation
3. Baseline + variant analysis save
4. Analysis update
5. Analysis compare
6. Export formats
7. GitHub sync (optional, requires active integration + linked repo)
8. AI analysis with active settings profile (provider/model/effort)

