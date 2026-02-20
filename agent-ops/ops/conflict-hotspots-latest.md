# Conflict Hotspots Report

Updated: 2026-02-20T06:30:24.895Z
Branch: `main`
Working tree: tracked=5, untracked=0, total=5

## Active Hotspots

### P0 - OAuth callback architecture convergence

Reason: Shared auth flow spans router, oauth service, and API callback route; partial merge can break login.
Safe merge order: 1) services/oauth 2) server callback route 3) api-keys router

| Status | File |
|---|---|
| `M` | `apps/api/src/routers/api-keys/router.ts` |
| `M` | `apps/api/src/services/oauth/claude-oauth.ts` |
| `M` | `apps/api/src/services/oauth/oauth-credential-store.ts` |
| `M` | `apps/api/src/services/oauth/openai-oauth.ts` |

### P1 - Provider schema and DB alignment

Reason: Enum/column additions must stay aligned with router/input schemas and migrations.
Safe merge order: 1) DB migration SQL 2) schema enums/columns 3) API input/output schemas

| Status | File |
|---|---|
| `M` | `apps/api/src/routers/api-keys/router.ts` |

## Unmapped Files

- `M` `agent-ops/ops/kanban-self-manage-latest.md`

## Operator Notes

- Stage and commit only files for one hotspot at a time.
- Re-run `pnpm quality:gate` after each hotspot merge batch.
- Keep OpenAI OAuth auth path intact; do not remove existing callback support until dual-mode checks pass.

