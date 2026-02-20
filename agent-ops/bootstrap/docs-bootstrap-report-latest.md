# Docs Bootstrap Report

Updated: 2026-02-20T07:44:27.024Z

## Inputs

- Documents analyzed: 1
- ../../../Downloads/TradeAI_Pro_PRD.docx (417 lines, 11937 chars)

## COS Summary

- Tasks generated: 55
- Effort total: 563h
- Contingency: 20% (112.6h)
- Effort total with contingency: 675.6h
- Development cost: 810720 TRY

## Transfer Status

- GitHub: skipped (created 0/0)
  reason: GITHUB_REPO or GITHUB_TOKEN missing
- Kanban: pushed (inserted 55/55, deduped 0)

## Usage

1. Analyze docs and generate outputs:
   `pnpm ops:bootstrap:docs`
2. Push to GitHub + Kanban (requires env vars):
   `pnpm ops:bootstrap:docs:push -- --project-id <PROJECT_UUID>`

Required env for push: `GITHUB_REPO`, `GITHUB_TOKEN`, `KANBAN_PROJECT_ID` (or `--project-id`).

