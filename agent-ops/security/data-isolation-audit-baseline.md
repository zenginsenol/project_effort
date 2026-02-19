# Data Isolation Audit Baseline (B-000)

Date: 2026-02-19
Owner: Agent-B

## Scope

- `apps/api/src/trpc/context.ts`
- `apps/api/src/trpc/trpc.ts`
- `apps/api/src/routers/**`
- `packages/db/src/schema/**`

## Findings

1. API procedures are currently exposed via `publicProcedure` in most routers.
2. Context does not currently populate authenticated `userId` / `orgId`.
3. Service queries do not consistently enforce `organization_id` filtering.
4. Web middleware is in demo bypass mode, so tenant boundaries are weak at entrypoint.

## Risk

- Cross-tenant data access risk in production paths.
- Unauthorized API access risk where frontend bypasses expected flows.

## Priority Fix List

1. Populate auth context (`userId`, `orgId`) from verified tokens.
2. Move sensitive routers to `authedProcedure`/`orgProcedure`.
3. Add organization filters to all tenant-owned entities.
4. Add automated negative tests for cross-tenant access.

## Acceptance Mapping

- Baseline audit document exists: Yes
- Actionable patch list exists: Yes
