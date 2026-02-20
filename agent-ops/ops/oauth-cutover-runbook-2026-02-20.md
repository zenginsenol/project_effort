# OAuth Callback Cutover Runbook (H-008)

Date: 2026-02-20  
Owner: Ops  
Status: completed

## Purpose

Define environment-specific OAuth callback routing, required env variables, port/collision troubleshooting, and on-call escalation for go-live and post-cutover incidents.

## Callback Strategy by Environment

| Environment | Mode | Redirect Behavior | Required Settings |
|---|---|---|---|
| Local development | `local_temp_server` | Browser callback to `http://localhost:1455/auth/callback` via temporary callback server | `OPENAI_OAUTH_MODE=local_temp_server` |
| Staging | `api_server_callback` | OpenAI redirects to API route `/auth/openai/callback` | `OPENAI_OAUTH_MODE=api_server_callback`, `OAUTH_CALLBACK_BASE_URL=https://<staging-api-domain>` |
| Production | `api_server_callback` | OpenAI redirects to API route `/auth/openai/callback` | `OPENAI_OAUTH_MODE=api_server_callback`, `OAUTH_CALLBACK_BASE_URL=https://api.<domain>` |

Fallback callback base resolution (API mode):
1. `OAUTH_CALLBACK_BASE_URL`
2. `API_PUBLIC_URL`
3. `NEXT_PUBLIC_API_URL`
4. default `http://127.0.0.1:4000`

## Required Environment Variables

1. `OPENAI_OAUTH_MODE`
2. `OAUTH_CALLBACK_BASE_URL` (recommended for staging/prod)
3. `NEXT_PUBLIC_API_URL`
4. `NEXT_PUBLIC_APP_URL`
5. `OPENAI_OAUTH_CLIENT_ID` (if custom client is used)

## Pre-Cutover Validation

1. Confirm mode and callback base:
   - `printenv OPENAI_OAUTH_MODE`
   - `printenv OAUTH_CALLBACK_BASE_URL`
2. Verify API callback endpoint responds:
   - `GET /auth/openai/callback` with missing params should return controlled error page (not 500 crash)
3. Run auth regression tests:
   - `pnpm --filter @estimate-pro/api test -- src/services/oauth/__tests__/openai-oauth.test.ts src/services/oauth/__tests__/callback-session-store.test.ts`
4. Confirm quality gate:
   - `pnpm quality:gate`

## Port Collision + Firewall Troubleshooting

### Local callback port (1455)

Symptoms:
1. OAuth start fails with `Port 1455 is in use`.

Actions:
1. Find holder:
   - `lsof -i :1455`
2. Stop conflicting process (usually another local OAuth client / old node process).
3. Retry OAuth start flow.

### Firewall/Network blocks (staging/prod)

Symptoms:
1. OpenAI login succeeds but callback never reaches API route.
2. Callback route shows timeout or repeated state expiry.

Actions:
1. Verify ingress allows HTTPS callback path `/auth/openai/callback`.
2. Confirm load balancer forwards host/proto correctly to API service.
3. Check edge firewall/WAF rules for OpenAI redirect requests.
4. Validate TLS certificate chain and domain DNS resolution.

## Incident Triage + Escalation

Severity definitions:
1. Sev-1: OAuth login unavailable for all users in production.
2. Sev-2: OAuth failures for subset of users or single environment.
3. Sev-3: Recoverable user-specific failures.

Escalation path:
1. On-call engineer (Ops) investigates logs + callback route health.
2. API owner verifies OAuth mode/env + pending state flow.
3. Platform/Infra owner validates ingress/firewall/TLS route.
4. Product/Manager decision on temporary workaround (manual key entry) if needed.

Rollback trigger:
1. Sev-1 persists >15 minutes with no mitigation.
2. Trigger deployment rollback and restore last-known-good callback mode.

## Cross Links

1. `agent-ops/ops/release-checklist-go-live-2026-02-19.md`
2. `agent-ops/ops/production-deploy-readiness-2026-02-19.md`
3. `agent-ops/ops/oauth-callback-dual-mode-design-2026-02-19.md`
