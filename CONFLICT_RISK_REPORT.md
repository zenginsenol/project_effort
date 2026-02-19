# Conflict Risk Report

Updated: 2026-02-19
Scope: Parallel in-progress changes on API auth/document/settings/db flow.

## P0 - Critical

1. OAuth callback architecture divergence
- `apps/api/src/server.ts`: `/auth/openai/callback` route removed.
- `apps/api/src/services/oauth/openai-oauth.ts`: callback hardcoded to `http://localhost:1455/auth/callback`.
- `apps/api/src/routers/api-keys/router.ts`: OAuth flow starts temporary localhost callback server.
- Risk: Non-local/deployed environments may fail OAuth callback.

## P1 - High

1. OAuth concurrency race
- `apps/api/src/services/oauth/openai-oauth.ts`: singleton `activeCallbackServer` closes previous session.
- Risk: one user can break another in-flight OAuth login.

2. DB/runtime alignment requirements
- `packages/db/src/schema/enums.ts`: provider enum extended with `openrouter`.
- `packages/db/src/schema/api-keys.ts`: `reasoningEffort` column added.
- Risk: DB schema must be pushed/migrated before deployment.

3. UX route readiness gap
- `apps/web/src/components/layout/sidebar.tsx` adds `/dashboard/compare` navigation.
- Risk: 404 unless page exists.
- Mitigation applied: added `apps/web/src/app/dashboard/compare/page.tsx` placeholder.

## P2 - Medium

1. Type/lint stability in task extraction flow
- `apps/api/src/services/document/task-extractor.ts` had unsafe typing in OpenAI/OpenRouter request/response handling.
- Mitigation applied locally: strict request/response typing path updated; `pnpm --filter @estimate-pro/api typecheck` and `pnpm quality:gate` pass.

## Verification

- `pnpm --filter @estimate-pro/api typecheck` -> pass
- `pnpm --filter @estimate-pro/api lint` -> pass (warnings only)
- `pnpm --filter @estimate-pro/web typecheck` -> pass
- `pnpm quality:gate` -> pass

