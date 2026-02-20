# OAuth Max Flow Compatibility - Latest

Date: 2026-02-20
Scope: Make AI analysis pipelines compatible with Anthropic OAuth "Max mode" tokens.

## Context

Parallel auth changes introduced Anthropic "Max mode" OAuth:
- Access token + refresh token are stored
- API usage should be `Authorization: Bearer ...` with beta header

However, analysis pipelines still assumed:
- OAuth refresh always via OpenAI refresh endpoint
- Anthropic token always usable as `x-api-key` via SDK

This created a runtime risk for:
- Ingest text/file analysis
- Effort AI analysis generation

## Implemented Compatibility Layer

1. `document router` OAuth refresh fix
- File: `apps/api/src/routers/document/router.ts`
- For `provider=anthropic` + OAuth token:
  - refresh now uses `refreshClaudeAccessToken(...)`
  - OpenAI OAuth tokens still refresh with `refreshAccessToken(...)`
  - returns provider config with:
    - `authMethod: 'oauth'`
    - `oauthBetaHeader: 'oauth-2025-04-20'`

2. `cost-analysis service` OAuth refresh fix
- File: `apps/api/src/routers/effort/cost-analysis-service.ts`
- Same provider-specific refresh branching added for Anthropic vs OpenAI.
- Passes `authMethod` + `oauthBetaHeader` into AI provider config.

3. `task-extractor` Anthropic OAuth transport support
- File: `apps/api/src/services/document/task-extractor.ts`
- `AIProviderConfig` expanded with optional:
  - `authMethod`
  - `oauthBetaHeader`
- Anthropic extraction now supports two paths:
  - `api_key` -> existing Anthropic SDK path (`x-api-key`)
  - `oauth` -> direct HTTP call with:
    - `Authorization: Bearer ...`
    - `anthropic-beta: oauth-2025-04-20`
    - `anthropic-version: 2023-06-01`

## Validation

- `pnpm --filter @estimate-pro/api typecheck` -> pass
- `pnpm --filter @estimate-pro/api test` -> pass (17/17)

## Notes

- Parallel auth source files (`api-keys/router.ts`, `claude-oauth.ts`, `openai-oauth.ts`, `oauth-credential-store.ts`) were not modified in this patch.
- This patch is additive compatibility to prevent analysis workflows from breaking while auth flow evolves in parallel.
