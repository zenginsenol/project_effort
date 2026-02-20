# Production Cutover Execution + Immediate Verification (H-015)

Date: 2026-02-20  
Owner: Ops  
Status: completed

## Scope

Execute cutover command sequence and verify immediate runtime health for API + Web artifacts.

## Execution Steps

1. Run consolidated cutover flow checks:
   - `pnpm ops:flow:run`
2. Bring up API runtime and verify health.
3. Bring up Web runtime and verify health endpoints and dashboard route.
4. Confirm no immediate runtime error on startup/smoke path.

## Evidence

### A) Flow Runner

1. Command: `pnpm ops:flow:run`
2. Result: pass (all core steps passed)
3. Gate summary:
   - Docs/COS: pass
   - Effort workflow: pass
   - Module contracts: pass
   - Transfer readiness: warn (external env missing)
   - AI provider health: warn (provider-side rate limit)
4. Output file:
   - `agent-ops/ops/go-live-flow-runner-latest.md`

### B) Runtime Smoke

1. API probe:
   - `GET http://127.0.0.1:4000/health` -> `200`
2. Web probes:
   - `GET http://127.0.0.1:3100/healthz` -> `200`
   - `GET http://127.0.0.1:3100/dashboard` -> `200`

## Rollback Trigger Check

1. No immediate error met rollback trigger conditions.
2. Services can be cleanly stopped and restarted in rehearsal flow.

## Outcome

Cutover execution path and immediate verification checks completed successfully for Wave-2 release flow.
