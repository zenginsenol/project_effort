# Infrastructure Topology Baseline (G-000)

Date: 2026-02-19
Owner: Ops

## Current Local Topology

- Web app: Next.js (`apps/web`) on port 3000
- API app: Fastify/tRPC (`apps/api`) on port 4000
- PostgreSQL: Docker (`pgvector/pg16`) mapped to 5433
- Redis: Docker (`redis:7-alpine`) mapped to 6380

## Target Environments

1. Development (local)
2. Staging (production-like)
3. Production

## Required Infra Components

- App hosting for web and API
- Managed PostgreSQL with backup/restore
- Managed Redis for cache/rate limiting
- TLS termination and domain routing
- Secret management for auth and AI keys
- Monitoring, alerting, and centralized logs

## Ownership

- Ops: infra provisioning and observability
- Agent-A: API/runtime configs and deployment readiness
- Agent-B: DB migration safety and data integrity
- QA: smoke tests and release validation
- Manager: cutover/rollback decision

## Open Risks

1. Production topology and provider selection not finalized.
2. Domain/SSL runbook not finalized.
3. DR restore test not yet implemented.
