# Conflict Hotspots Report

Updated: 2026-02-20T06:53:35.519Z
Branch: `main`
Working tree: tracked=14, untracked=5, total=19

## Active Hotspots

### P0 - OAuth callback architecture convergence

Reason: Shared auth flow spans router, oauth service, and API callback route; partial merge can break login.
Safe merge order: 1) services/oauth 2) server callback route 3) api-keys router

| Status | File |
|---|---|
| `M` | `apps/api/src/routers/api-keys/router.ts` |
| `M` | `apps/api/src/services/oauth/__tests__/openai-oauth.test.ts` |
| `M` | `apps/api/src/services/oauth/claude-oauth.ts` |
| `M` | `apps/api/src/services/oauth/oauth-credential-store.ts` |
| `M` | `apps/api/src/services/oauth/openai-oauth.ts` |
| `??` | `apps/api/src/routers/api-keys/__tests__/` |
| `??` | `apps/api/src/services/oauth/__tests__/callback-session-store.test.ts` |
| `??` | `apps/api/src/services/oauth/callback-session-store.ts` |

### P1 - Provider schema and DB alignment

Reason: Enum/column additions must stay aligned with router/input schemas and migrations.
Safe merge order: 1) DB migration SQL 2) schema enums/columns 3) API input/output schemas

| Status | File |
|---|---|
| `M` | `apps/api/src/routers/api-keys/router.ts` |

### P1 - Document analysis contract drift

Reason: Changes in extraction service and router schema can diverge and cause runtime parse errors.
Safe merge order: 1) document schema 2) extractor service 3) document router

| Status | File |
|---|---|
| `M` | `apps/api/src/routers/document/router.ts` |
| `??` | `apps/api/src/routers/document/__tests__/` |

### P2 - Web settings/compare UX consistency

Reason: Navigation, compare page, and settings panel can drift from backend capabilities.
Safe merge order: 1) compare route 2) settings page 3) sidebar/nav links

| Status | File |
|---|---|
| `M` | `apps/web/src/app/dashboard/compare/page.tsx` |
| `M` | `apps/web/src/app/dashboard/settings/page.tsx` |

## Unmapped Files

- `M` `PROJECT_TRACKER.md`
- `M` `agent-ops/agent-backlog.json`
- `M` `agent-ops/agent-next-tasks.md`
- `M` `agent-ops/ops/go-live-wave2-status.md`
- `M` `agent-ops/ops/kanban-self-manage-latest.md`
- `M` `apps/api/src/routers/effort/cost-analysis-service.ts`
- `??` `agent-ops/ops/comparative-analysis-contract-2026-02-20.md`

## Operator Notes

- Stage and commit only files for one hotspot at a time.
- Re-run `pnpm quality:gate` after each hotspot merge batch.
- Keep OpenAI OAuth auth path intact; do not remove existing callback support until dual-mode checks pass.

