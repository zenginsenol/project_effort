# Module Integration Playbook (Step-by-Step)

Updated: 2026-02-19T12:58:00Z
Goal: Eliminate cross-module communication breaks and keep API/Web/DB/Integrations fully aligned.

## Step 1 - Freeze Interfaces (Contract First)

1. Lock procedure names and payload shapes used by Web.
2. Confirm these critical contracts are present and unchanged:
   - Effort roadmap/apply roadmap
   - GitHub project link/sync procedures
   - OAuth start + callback route
   - Analyzer document endpoint
3. Run: `pnpm ops:integration:check`

Exit criteria:
- Contract matrix shows `pass` for all listed areas.

## Step 2 - Resolve Hotspots in Safe Merge Order

1. Run: `pnpm ops:conflicts`
2. Merge one hotspot at a time:
   - P0: OAuth/API-keys path
   - P1: DB/provider + document contract
   - P2: web settings/compare UX
3. After each hotspot merge batch run:
   - `pnpm ops:integration:check`
   - `pnpm quality:gate`

Exit criteria:
- No contract failure after each hotspot batch.

## Step 3 - Keep DB and API in Lockstep

1. Apply migration artifacts before API schema changes.
2. Ensure router/input schema updates match DB enums/columns.
3. Validate with API typecheck/tests.

Commands:
- `pnpm --filter @estimate-pro/api typecheck`
- `pnpm --filter @estimate-pro/api test`

Exit criteria:
- API typecheck and tests pass after each DB-linked change.

## Step 4 - Validate Web-to-API Integration Paths

1. Verify settings page can start OAuth flow.
2. Verify project page can link/sync GitHub project.
3. Verify effort page can generate/apply roadmap.
4. Verify analyzer page calls `/api/analyze-document` successfully.

Exit criteria:
- Web-side procedures map 1:1 to active API procedures.

## Step 5 - Run Full Integration Gate

Before deployment:
1. `pnpm ops:integration:gate`
2. `pnpm ops:wave2:status`
3. `pnpm agent:status`

Exit criteria:
- Integration gate passes.
- No blocker in wave status.

## Step 6 - Deploy with Post-Cutover Verification

1. Execute production deployment runbook.
2. Re-run smoke flow on OAuth, GitHub sync, effort roadmap, analyzer.
3. Start hypercare monitoring and incident response.

Exit criteria:
- End-to-end paths stable in production.

## Operational Rule (Non-negotiable)

- Never merge mixed hotspots in one commit.
- Always re-run integration check after each hotspot batch.
- Keep OpenAI auth callback operational during transition.
