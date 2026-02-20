# Go-Live UI Flow Redesign - 2026-02-20

## Objective

Make the go-live path explicit and low-friction across modules:
1. Clear menu phases and next-step transitions.
2. Visible "what moves where" transfer map.
3. Stronger Kanban dashboard transitions.
4. Fully guided Effort/Cost and Compare workflows.
5. URL-based project handoff between screens.

## Agent-Style Work Breakdown

Execution lanes used to organize the work:
1. `NAV_AGENT`: workflow IA and phase grouping (`Ingest -> Plan -> Estimate -> Operate`).
2. `CONTROL_AGENT`: control center and transfer-map visibility.
3. `KANBAN_AGENT`: project cards + project-detail transitions.
4. `COST_AGENT`: effort workflow step structure + project handoff.
5. `COMPARE_AGENT`: provider compare workflow + project context bridging.
6. `QA_AGENT`: type/lint gates.

## Research Notes (AutoClaude-style interaction patterns)

UI direction was aligned to common autonomous orchestration patterns:
1. Keep the user in a visible staged workflow.
2. Always expose next action instead of dead-end screens.
3. Show state transfer between modules, not just isolated pages.
4. Surface one-click progression links at each stage.

## Detailed Changes

### 1) Navigation / Layout Shell

Files:
- `apps/web/src/components/layout/navigation-data.ts`
- `apps/web/src/components/layout/sidebar.tsx`
- `apps/web/src/components/layout/header.tsx`

Delivered:
1. Centralized navigation model with ordered workflow phases.
2. Removed dead nav item (`/dashboard/team`) from active menu graph.
3. Sidebar redesigned as phase-grouped workflow blocks with per-item purpose text.
4. Header now shows:
   - Active module context.
   - Phase badge.
   - Next-step shortcut.

Outcome:
- User can see current stage and immediate next screen at all times.

### 2) Control Center Redesign

File:
- `apps/web/src/app/dashboard/page.tsx`

Delivered:
1. Replaced flat dashboard with go-live control center hero.
2. Added flow completion indicator using phase completion logic.
3. Added phase cards with deep links to each module.
4. Added transfer map cards:
   - Analyzer output -> Projects
   - Projects -> Effort snapshots
   - Effort -> Compare
   - Final analyses -> Integrations/GitHub
5. Added execution pulse panel (status distribution + go-live signals).

Outcome:
- "What we do and where we transfer it" is directly visible.

### 3) Kanban Project Dashboard Redesign

File:
- `apps/web/src/app/dashboard/projects/page.tsx`

Delivered:
1. Added workflow hero with project-level KPIs.
2. Added explicit stage cards (`Ingest`, `Execute`, `Estimate/Compare`).
3. Each project card now contains:
   - Progress bar.
   - Backlog/Active/Done counts.
   - One-click transitions to:
     - Kanban board
     - Effort page (project preselected)
     - Compare page (project context)
     - Analyzer page (project context)

Outcome:
- Kanban page became the main traffic hub for downstream effort/compare actions.

### 4) Project Detail Transition Layer

File:
- `apps/web/src/app/dashboard/projects/[projectId]/page.tsx`

Delivered:
1. Added top transition shortcuts for selected project:
   - Add tasks from docs.
   - Run effort/cost.
   - Compare models.
2. Keeps users in project context while switching modules.

Outcome:
- Project-level execution no longer requires manual re-selection on each screen.

### 5) Analyzer Project Context Handoff

File:
- `apps/web/src/app/dashboard/analyzer/page.tsx`

Delivered:
1. Added `projectId` query-param preselection support.
2. Added ingest save mode:
   - Save to existing project.
   - Auto-create new project and save tasks.
3. Added project auto-draft fields (name/key/description) from analysis context.
4. Added one-click continuation links after save:
   - Open Kanban board
   - Continue to Effort
5. Added fallback option in existing mode:
   - If no project selected, auto-create project from ingest summary.

Outcome:
- Projects -> Analyzer handoff now lands with project context already selected.
- Ingest can complete end-to-end even when user has no pre-existing project.

### 6) Compare Workflow Redesign

File:
- `apps/web/src/app/dashboard/compare/page.tsx`

Delivered:
1. Added workflow hero with step model.
2. Added project selection and query-param bootstrapping (`?projectId=...`).
3. Added forward links to Effort workspace and Settings.
4. Added final-step CTA block after results for operational continuation.

Outcome:
- Compare screen now behaves as a decision stage in a bigger workflow, not an isolated experiment page.

### 7) Effort/Cost Workflow Redesign

File:
- `apps/web/src/app/dashboard/effort/page.tsx`

Delivered:
1. Added workflow hero and step map.
2. Added project query-param hydration and URL sync (`?projectId=...`).
3. Converted major sections to explicit step labels:
   - Step 1: parameters
   - Step 2: roadmap
   - Step 3: baseline summary
   - Step 4: snapshot workspace
   - Step 5: AI analysis
   - Step 6: saved analyses
   - Step 7: compare analyses
   - Step 8: export + GitHub
4. Added direct bridge to provider-level compare from compare-analyses section.

Outcome:
- Cost workspace is now a guided operational pipeline suitable for repeatable project usage.

## Validation

Commands run:
1. `pnpm --filter @estimate-pro/web typecheck`
2. `pnpm --filter @estimate-pro/web lint`

Results:
1. Typecheck: PASS
2. Lint: PASS (Next.js deprecation notice only, no lint errors)

## Go-Live Readiness Delta (UX)

Resolved gaps:
1. Hidden transitions between modules.
2. Weak project-context carry-over.
3. Cost workflow discoverability issues.
4. Compare-to-operational decision gap.

Remaining suggested follow-up:
1. Optional E2E scenario for full transition chain:
   - Projects -> Analyzer -> Effort -> Compare -> Effort export/github
2. Optional mobile UX pass for long tables in Effort/Compare sections.
