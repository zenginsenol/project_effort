# Production Deploy Readiness (G-002)

Date: 2026-02-19  
Owner: Ops

## Scope

Production infrastructure readiness for:
- Domain + TLS
- App/API runtime
- Secret management
- Deployment prerequisites

## Required Infrastructure

1. DNS
- `app.estimatepro.com` -> Web ingress
- `api.estimatepro.com` -> API ingress

2. TLS
- Managed certificates (auto-renew)
- TLS termination at ingress/load balancer

3. Runtime
- Web: Next.js production server
- API: Fastify server (`apps/api`)

4. Data
- Managed PostgreSQL (with pgvector)
- Managed Redis

5. Secrets
- `DATABASE_URL`
- `REDIS_URL`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `INTEGRATION_TOKEN_ENCRYPTION_KEY`

6. Public Runtime Config (required)
- `NEXT_PUBLIC_API_URL` (web client -> API base URL)
- `OPENAI_OAUTH_MODE=api_server_callback` (deployed web OAuth callback mode)

## Validation Checklist

- [x] Production env template created (`.env.production.example`)
- [x] Staging parity completed (see `staging-parity-validation-2026-02-19.md`)
- [x] Quality gate command exists and passes locally (`pnpm quality:gate`)
- [x] Integration tokens encrypted at rest in API layer

## Deployment Command Set

1. Install and build
- `pnpm install --frozen-lockfile`
- `pnpm build`

2. Database migration
- `pnpm db:push`

3. Start services
- API: `pnpm --filter @estimate-pro/api start`
- Web: `pnpm --filter @estimate-pro/web start`

## Result

Production environment is deployment-ready from configuration and runbook perspective.
