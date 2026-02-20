# Cost & Effort Process Validation - Step-by-Step

## Objective

Validate that the project cost/effort workflow works end-to-end in real usage:
1. Effort calculation
2. Roadmap generation
3. Cost analysis snapshot save/edit
4. Compare analyses
5. Export analyses
6. AI-based analysis using Settings provider/model/effort profile
7. (Optional) GitHub sync

## Preconditions

1. Database is up and migrated.
2. At least one project exists.
3. At least one user exists.
4. For AI step: provider key must be active in Settings.
5. For GitHub step: active GitHub integration + repository link.

## Automated Validation Command

Run:

```bash
pnpm ops:effort:workflow:check
```

What this command does:

1. Selects project + org + user context.
2. Runs `effort.calculate`.
3. Runs `effort.roadmap`.
4. Saves baseline analysis.
5. Saves variant analysis.
6. Lists analyses and verifies IDs.
7. Updates analysis editable sections.
8. Compares analyses.
9. Exports analysis in `json`, `csv`, `md`.
10. Tries AI analysis for each active provider in Settings profile.
11. Cleans up generated test analyses.
12. Writes latest report:
   - `agent-ops/ops/cost-workflow-check-latest.md`

Alternative:

```bash
pnpm ops:effort:workflow:check:keep
```

Use `:keep` only when you want generated test analyses to stay in DB.

## Latest Validation Snapshot (2026-02-20)

Source:
- `agent-ops/ops/cost-workflow-check-latest.md`

Summary:
1. `pass=8`
2. `warn=1`
3. `skip=1`
4. `fail=0`

Interpretation:
1. Core cost/effort pipeline is operational end-to-end.
2. Warning is provider quota/rate-limit related (OpenAI 429), not integration breakage.
3. Skipped step is GitHub sync because GitHub integration was not connected in the active org.

## Unified Flow Roadmap Snapshot

Run:

```bash
pnpm ops:flow:roadmap
```

Output:
- `agent-ops/ops/effort-flow-roadmap-latest.md`

This consolidates:
1. Docs -> COS effort/cost baseline.
2. Cost workflow gate result.
3. Module integration contract result.
4. GitHub + Kanban transfer readiness.
5. Agent backlog execution snapshot.

## Single-Command Orchestration

Run:

```bash
pnpm ops:flow:run
```

Optional (when transfer env is configured):

```bash
pnpm ops:flow:run:transfer -- --project-id <PROJECT_UUID>
```

Output:
- `agent-ops/ops/go-live-flow-runner-latest.md`

This command executes docs bootstrap + integration check + effort workflow check + unified roadmap in sequence and writes one combined execution report.

## Manual UI Process Test (Step-by-Step)

1. Open `/dashboard/settings`.
2. Verify active provider + model + reasoning effort.
3. Open `/dashboard/effort`.
4. Select project.
5. Click `Save Current Snapshot`.
6. Create a second scenario by changing rate/contingency and save again.
7. In saved analyses table:
   - Pick one as selected record.
   - Select two for compare.
8. Verify compare table deltas.
9. Export selected analysis (`JSON`, `CSV`, `Markdown`).
10. If GitHub integration linked:
   - Click `Sync to GitHub`.
   - Verify issue URL is returned and opens correctly.

## Result Decision Rules

1. If any step is `fail`: treat as blocking defect before go-live.
2. If only AI step is `warn` with provider 429/quota: platform flow is valid, provider billing must be adjusted.
3. If export/compare/save steps fail: stop rollout and fix before production transition.
