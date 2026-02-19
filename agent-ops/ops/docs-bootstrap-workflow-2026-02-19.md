# Docs-to-Execution Bootstrap Workflow

Updated: 2026-02-19T13:30:00Z

Goal: At project kickoff, analyze requirement documents, produce COS (Cost Of Scope), create tasks, then transfer to GitHub and Kanban.

## 1) Analyze Initial Documents

Run:

```bash
pnpm ops:bootstrap:docs
```

This command:
- Scans initial docs (root `.docx`, `PROJECT_TRACKER.md`, `README.md` or `BOOTSTRAP_DOCS` override).
- Extracts requirement lines and section headers.
- Generates kickoff tasks with type/priority/effort.
- Calculates COS summary (hours + contingency + TRY cost).
- Produces output artifacts under `agent-ops/bootstrap/`.

## 2) Review Generated Outputs

Files:
- `agent-ops/bootstrap/docs-bootstrap-report-latest.md`
- `agent-ops/bootstrap/docs-bootstrap-analysis-latest.json`
- `agent-ops/bootstrap/docs-bootstrap-github-issues-latest.json`
- `agent-ops/bootstrap/docs-bootstrap-kanban-tasks-latest.json`

Review checklist:
1. Are sections represented as actionable tasks?
2. Are priority and effort values realistic?
3. Are critical integrations (OAuth/GitHub/Kanban/AI) covered?

## 3) Push Tasks to GitHub and Kanban

Set env vars:
- `GITHUB_REPO=owner/repo`
- `GITHUB_TOKEN=<token>`
- `KANBAN_PROJECT_ID=<project_uuid>` (or pass `--project-id`)

Run:

```bash
pnpm ops:bootstrap:docs:push -- --project-id <project_uuid>
```

Transfer behavior:
- GitHub: creates issues from generated task payload.
- Kanban: inserts tasks into selected project board, with duplicate-title skip logic.

## 4) Validate Integration Health

After transfer:

```bash
pnpm ops:integration:check
pnpm ops:integration:gate
```

Expected:
- Contract matrix pass.
- Quality gate pass.

## 5) Continue with Wave-2 Go-Live Sequence

```bash
pnpm ops:conflicts
pnpm ops:wave2:status
pnpm agent:status
```

Apply hotspot batches in order and repeat integration checks after each batch.

## Usage Scenarios

1. New project kickoff from PRD/analysis docs.
2. Existing project re-baseline after scope change.
3. Parallel team onboarding where one source of truth is required.
4. Pre-sale to delivery handoff with immediate backlog creation.
5. Monthly planning reset with updated cost/effort baseline.
