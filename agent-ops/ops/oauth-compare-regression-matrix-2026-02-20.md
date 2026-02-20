# OAuth + Comparative Analysis Regression Matrix (H-007)

Date: 2026-02-20  
Owner: QA  
Status: completed

## Scope

Regression coverage for:
1. OAuth start/callback/mode/timeout safety.
2. Comparative analysis success/partial/failure contract stability.
3. Provider-override isolation and credential safety.

## Automated Scenario Matrix

| Area | Scenario | Type | Evidence |
|---|---|---|---|
| OpenAI OAuth | Local callback URL (`localhost:1455`) is generated in local mode | Unit | `apps/api/src/services/oauth/__tests__/openai-oauth.test.ts` |
| OpenAI OAuth | API callback URL resolves from `OAUTH_CALLBACK_BASE_URL` | Unit | `apps/api/src/services/oauth/__tests__/openai-oauth.test.ts` |
| OpenAI OAuth | API callback fallback chain (`API_PUBLIC_URL` -> `NEXT_PUBLIC_API_URL` -> default API origin) | Unit | `apps/api/src/services/oauth/__tests__/openai-oauth.test.ts` |
| OAuth concurrency | State sessions are isolated in concurrent flow | Unit | `apps/api/src/services/oauth/__tests__/callback-session-store.test.ts` |
| OAuth concurrency | Session timeout cleanup for abandoned flows | Unit | `apps/api/src/services/oauth/__tests__/callback-session-store.test.ts` |
| Compare contract | Full success returns deterministic envelope (`status/results/errors/summary`) | Unit | `apps/api/src/routers/document/__tests__/comparative-contract.test.ts` |
| Compare contract | Partial success returns coded + sorted errors | Unit | `apps/api/src/routers/document/__tests__/comparative-contract.test.ts` |
| Compare contract | Full failure returns `status=failed` with summary counters | Unit | `apps/api/src/routers/document/__tests__/comparative-contract.test.ts` |
| Tenant isolation | Provider override mismatch cannot consume another provider key | Unit | `apps/api/src/routers/document/__tests__/tenant-provider-override.test.ts` |
| Tenant isolation | `comparativeAnalyze` returns `missing_config` when safe provider resolution fails | Unit | `apps/api/src/routers/document/__tests__/tenant-provider-override.test.ts` |
| API keys | OpenRouter model validation rejects invalid model format | Unit | `apps/api/src/routers/api-keys/__tests__/openrouter-flow.test.ts` |
| API keys | Provider mismatch row is rejected in `getKeyForProvider` | Unit | `apps/api/src/routers/api-keys/__tests__/openrouter-flow.test.ts` |

## Command Evidence

1. Targeted suite:
   - `pnpm --filter @estimate-pro/api test -- src/routers/document/__tests__/tenant-provider-override.test.ts src/routers/api-keys/__tests__/openrouter-flow.test.ts`
   - Result: `2 files / 6 tests passed`
2. Full API suite:
   - `pnpm --filter @estimate-pro/api test`
   - Result: `8 files / 32 tests passed`
3. Type safety:
   - `pnpm --filter @estimate-pro/api typecheck`
   - Result: pass

## Manual Sanity Checklist (Go-Live Smoke)

1. Open `/dashboard/settings` and run OpenAI OAuth start flow.
2. Verify local mode uses browser callback to `http://localhost:1455/auth/callback`.
3. Verify deployed mode with `OPENAI_OAUTH_MODE=api_server_callback` and API callback route.
4. Run compare flow from `/dashboard/compare` with at least two providers.
5. Confirm partial provider failures are rendered with summary banner and coded errors.

## Conclusion

Regression matrix covers both happy-path and failure-path behavior for OAuth and comparative analysis, including provider isolation and deterministic API contract behavior.
