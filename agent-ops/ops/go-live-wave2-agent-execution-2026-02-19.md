# Go-Live Wave-2 Agent Execution Plan

Date: 2026-02-19
Owner: Manager
Program: EstimatePro Production Hardening Wave-2

## Objective

Close all remaining go-live blockers with strict agent orchestration and release gates.
Wave-2 starts from unresolved conflict risks and parallel-development integration points.

## Entry Conditions

- `agent-ops/agent-backlog.json` includes Phase H tasks (`H-000` ... `H-017`)
- `CONFLICT_RISK_REPORT.md` published and referenced as technical baseline
- Existing Phase A-G baseline completed

## Wave-2 Release Gates

### Gate 1: Technical Hardening (P0)

Required done tasks:
- `H-001` OAuth callback architecture reconciliation
- `H-002` OAuth concurrency race elimination
- `H-003` DB migration artifact prep
- `H-004` staging migration dry-run evidence
- `H-009` release gate review #1

Exit rule:
- No unresolved P0 blocker in auth, DB rollout, or API contract integrity.

### Gate 2: Product + Quality Readiness (P1)

Required done tasks:
- `H-005` Compare AI production UI
- `H-006` comparative API contract hardening
- `H-007` regression matrix
- `H-010` provider/openrouter edge-case hardening
- `H-011` tenant isolation verification
- `H-012` integrated validation pack

Exit rule:
- Quality evidence pack green and all P1 risks accepted or closed.

### Gate 3: Cutover Authorization

Required done tasks:
- `H-013` pre-prod rehearsal + rollback drill
- `H-014` go/no-go decision
- `H-015` production cutover execution

Exit rule:
- Production deployment successful with smoke checks and healthy monitoring.

### Gate 4: Hypercare Closure

Required done tasks:
- `H-016` week-1 hypercare
- `H-017` release sign-off package

Exit rule:
- Hypercare exit criteria met and steady-state ownership transferred.

## Agent Responsibility Matrix

- `Agent-A`:
  - OAuth architecture and concurrency hardening (`H-001`, `H-002`)
  - comparative API contract and provider edge cases (`H-006`, `H-010`)
- `Agent-B`:
  - DB migration strategy and tenant isolation verification (`H-003`, `H-011`)
- `Agent-C`:
  - Compare AI UI productionization (`H-005`)
- `QA`:
  - auth/compare regression and integrated validation pack (`H-007`, `H-012`)
- `Ops`:
  - staging migration execution, runbooks, rehearsal, cutover (`H-004`, `H-008`, `H-013`, `H-015`)
- `Manager`:
  - governance, release gates, hypercare closure (`H-000`, `H-009`, `H-014`, `H-016`, `H-017`)

## Daily Execution Loop

1. `pnpm agent:status`
2. `pnpm agent:next`
3. `pnpm agent:advance`
4. Execute active tasks and collect evidence
5. `node scripts/agent-orchestrator.mjs done <TASK_ID>`
6. `pnpm agent:report`
7. Update `PROJECT_TRACKER.md` with new evidence and risks

## Blocking Policy

- Any blocker must be recorded with:
  - Task ID
  - technical root cause
  - owner
  - unblock action + ETA
- Command:
  - `node scripts/agent-orchestrator.mjs block <TASK_ID> "<reason>"`

## Minimum Evidence Set Before Production

- Passing command evidence:
  - `pnpm quality:gate`
  - `pnpm --filter @estimate-pro/api typecheck`
  - `pnpm --filter @estimate-pro/web typecheck`
- OAuth flow validation in targeted deployment mode
- DB migration forward + rollback evidence
- Compare AI smoke (multi-provider and partial-failure path)
- Monitoring alerts and on-call route validation

