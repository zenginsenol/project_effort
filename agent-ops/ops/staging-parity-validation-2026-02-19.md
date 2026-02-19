# Staging Environment Parity Validation (G-001)

Date: 2026-02-19  
Owner: Ops

## Objective

Staging environment parity finalized for core dependencies:
- Database
- Redis
- Environment variables
- Migration + quality gates

## Deliverables

1. Staging env template: `.env.staging.example`
2. Automated parity validator: `scripts/staging-parity-check.mjs`
3. Repeatable validation command:
   - `node scripts/staging-parity-check.mjs`

## Validation Checklist

- [x] `.env.staging.example` exists and includes all keys from `.env.example`
- [x] `docker-compose.yml` includes PostgreSQL + Redis services
- [x] Release gate scripts exist (`quality-gate`, `agent-orchestrator`)
- [x] Staging parity checker exits successfully

## Staging Bring-up Procedure

1. Create staging env file from template
   - `cp .env.staging.example .env.staging`
2. Fill secret values in `.env.staging`
3. Start dependencies (or managed service equivalents)
   - PostgreSQL 16 + pgvector
   - Redis 7
4. Apply schema
   - `pnpm db:push`
5. Optional seed for smoke validation
   - `pnpm db:seed`
6. Run full gate
   - `pnpm quality:gate`

## Result

Staging parity is reproducible and validated for DB/Redis/env/migration baseline.
