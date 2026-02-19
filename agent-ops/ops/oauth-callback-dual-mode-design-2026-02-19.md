# H-001 Design: OpenAI OAuth Callback Dual-Mode Strategy

Date: 2026-02-19
Task: `H-001`
Owners: Agent-A, Ops

## Problem Statement

Current implementation is coupled to localhost callback behavior (`http://localhost:1455/auth/callback`) and temporary server lifecycle.
This is valid for local/dev flows but risky for deployed environments where callback must terminate on API server route.

## Design Goal

Support both callback modes without breaking existing users:

1. `local_temp_server` mode (Codex-compatible localhost callback)
2. `api_server_callback` mode (`/auth/openai/callback` route)

Mode selection must be explicit and deterministic by environment.

## Proposed Runtime Contract

### Environment Variables

- `OPENAI_OAUTH_MODE`
  - allowed: `local_temp_server`, `api_server_callback`
  - default: `local_temp_server` in local/dev, `api_server_callback` in non-local deployments
- `OAUTH_CALLBACK_BASE_URL`
  - required when mode is `api_server_callback`
  - example: `https://api.example.com`

### Callback Resolver API

Create a single resolver function with output:

```ts
{
  mode: 'local_temp_server' | 'api_server_callback',
  redirectUri: string,
  shouldStartTempServer: boolean,
}
```

Usage points:
- `apiKeys.startOAuthLogin`
- OAuth callback/token exchange path

## Implementation Steps (Subtasks)

1. Add callback mode resolver in oauth service layer.
2. Restore/retain API callback handler path for server mode.
3. Keep temporary localhost callback server for local mode.
4. Ensure `storePendingFlow` persists mode + redirectUri per state.
5. During callback completion, validate state and mode ownership before token write.
6. Add telemetry logs with mode tag (`[oauth][mode=...]`).

## Backward Compatibility Rules

- Existing OAuth entries in `api_keys` remain valid.
- Token refresh logic in document router stays unchanged.
- If mode/env misconfigured, fail early with actionable TRPC error.

## Test Plan

### Unit/Integration

- Mode resolver returns expected output for env combinations.
- `startOAuthLogin` returns redirect URL matching selected mode.
- Callback handling writes tokens correctly in both modes.
- Missing `OAUTH_CALLBACK_BASE_URL` in server mode throws explicit error.

### Manual Smoke

- Local: click OAuth connect, complete flow, key appears in settings.
- Staging/API mode: callback returns to API route and persists token.
- Concurrent starts by two users do not overwrite pending state.

## Merge Strategy (Parallel-Safe)

Target files likely under parallel edits:
- `apps/api/src/services/oauth/openai-oauth.ts`
- `apps/api/src/routers/api-keys/router.ts`
- `apps/api/src/server.ts`

Apply as 3 small commits:
1. Resolver + types
2. Router integration (start/login)
3. Server callback route reconciliation

Each commit gates with:
- `pnpm --filter @estimate-pro/api typecheck`
- `pnpm --filter @estimate-pro/api test`

## Exit Criteria for H-001

- Dual-mode callback strategy is implemented and tested.
- Ops runbook references exact env requirements and fallback behavior.
- No regression in OAuth token refresh consumption path.

