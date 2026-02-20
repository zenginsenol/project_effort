# Docs Bootstrap Report

Updated: 2026-02-20T05:03:59.266Z

## Inputs

- Documents analyzed: 3
- Estimate Pro Document - Claude.docx (267 lines, 6728 chars)
- Estimate Pro Document - Project Effort Estimation.docx (267 lines, 6728 chars)
- Estimate Pro Teknik Stack.docx (181 lines, 6521 chars)

## COS Summary

- Tasks generated: 93
- Effort total: 1058h
- Contingency: 20% (211.6h)
- Effort total with contingency: 1269.6h
- Development cost: 1523520 TRY

## Transfer Status

- GitHub: pushed (created 50/50)
- Kanban: pushed (inserted 0/93, deduped 93)
  reason: all generated tasks already exist

## Usage

1. Analyze docs and generate outputs:
   `pnpm ops:bootstrap:docs`
2. Push to GitHub + Kanban (requires env vars):
   `pnpm ops:bootstrap:docs:push -- --project-id <PROJECT_UUID>`

Required env for push: `GITHUB_REPO`, `GITHUB_TOKEN`, `KANBAN_PROJECT_ID` (or `--project-id`).

