# Wave-2 Effort Roadmap + Kanban/GitHub Execution Plan

Updated: 2026-02-19T12:48:00Z
Owner: Codex (Agent-A orchestration support)

## 1) Planning Assumptions

- Scope: Remaining Phase-H work items (`H-001`..`H-017`) not yet completed.
- Team blended rate: `1,200 TRY/hour`.
- Effort confidence: medium (parallel-development conflict risk still active).
- Contingency for go-live hardening: `15%`.

## 2) Remaining Task Effort Plan

| Task | Owner | Planned Effort (h) | Cost (TRY) | Dependency Gate | Primary Deliverable |
|---|---|---:|---:|---|---|
| H-001 OAuth callback reconciliation | Agent-A | 12 | 14,400 | Gate-1 | Dual-mode callback convergence + regression evidence |
| H-002 OAuth concurrency race elimination | Agent-A | 10 | 12,000 | Gate-1 | Safe callback/session handling for concurrent logins |
| H-005 Compare AI dashboard productionization | Agent-C | 18 | 21,600 | Gate-2 | Stable compare UX + API consumption hardening |
| H-006 Comparative analysis API contract finalization | Agent-A | 14 | 16,800 | Gate-2 | Deterministic API schema and response behavior |
| H-007 OAuth/compare regression matrix | QA | 12 | 14,400 | Gate-2 | Test matrix + execution report |
| H-008 Cutover runbook update (OAuth strategy) | Ops | 8 | 9,600 | Gate-1 | Updated production runbook with callback decision tree |
| H-009 Release gate review #1 | Manager | 4 | 4,800 | Gate-1 | Blocker decision log |
| H-010 Provider edge-case hardening | Agent-A | 10 | 12,000 | Gate-2 | OpenRouter/provider edge case fixes + tests |
| H-011 Tenant isolation verification | Agent-B | 8 | 9,600 | Gate-2 | Isolation verification evidence |
| H-012 Integrated validation pack | QA | 12 | 14,400 | Gate-2 | Full validation report (quality/security/smoke) |
| H-013 Pre-prod rehearsal + rollback drill | Ops | 10 | 12,000 | Gate-3 | Rehearsal logs and rollback proof |
| H-014 Go/no-go release review | Manager | 4 | 4,800 | Gate-3 | Signed go/no-go record |
| H-015 Production cutover | Ops | 8 | 9,600 | Gate-3 | Production deployment execution log |
| H-016 Hypercare week-1 | Manager | 20 | 24,000 | Gate-4 | Incident/triage daily logs |
| H-017 Hypercare closure + sign-off | Manager | 6 | 7,200 | Gate-4 | Final release sign-off package |
| **Total (remaining)** |  | **156h** | **187,200 TRY** |  |  |

Contingency (15%):
- `23.4h` / `28,080 TRY`

Forecast total (remaining + contingency):
- `179.4h`
- `215,280 TRY`

## 3) Date-Based Roadmap (Execution Cadence)

| Window (2026) | Focus | Target Exit |
|---|---|---|
| Feb 20 - Feb 23 | Gate-1 (`H-001`, `H-002`, `H-008`, `H-009`) | OAuth and cutover strategy stabilized |
| Feb 24 - Feb 28 | Gate-2 core (`H-006`, `H-010`, `H-005`) | Product/API hardening complete |
| Mar 01 - Mar 03 | Gate-2 QA (`H-007`, `H-011`, `H-012`) | Validation pack green |
| Mar 04 - Mar 06 | Gate-3 (`H-013`, `H-014`, `H-015`) | Production cutover executed |
| Mar 07 - Mar 13 | Gate-4 (`H-016`, `H-017`) | Hypercare closed and signed off |

## 4) Kanban Auto-Apply + GitHub Integration Flow

This is the production workflow to keep effort/roadmap/board synchronized:

1. Open target project page: `/dashboard/projects/[projectId]`.
2. Ensure GitHub project link exists (`trpc.integration.getGithubProjectLink`).
3. Link repo if needed (`trpc.integration.linkGithubProject`).
4. Trigger import (`trpc.integration.syncGithubProject`) or use `Sync Now` UI.
5. Open effort page (`/dashboard/effort`) and generate roadmap (`trpc.effort.roadmap`).
6. Apply roadmap to board (`trpc.effort.applyRoadmap`) with deterministic ordering.
7. Re-open project Kanban and verify status/order mapping.

Backend guarantees already in place:
- External issues -> internal tasks mapping (status/type/priority/story points).
- Duplicate title skip behavior on repeated sync.
- Project-level GitHub repository binding (`projectLinks`).

## 5) Go-Live Month Non-Dev Budget Lines (Alternatives)

Development effort budget above must be paired with operational lines:

| Option | Monthly Ops Budget (TRY) | Suitable Context |
|---|---:|---|
| Starter | 12,000 - 22,000 | MVP pilots / low traffic |
| Growth | 25,000 - 48,000 | SME production baseline |
| Scale | 50,000 - 95,000 | High traffic / enterprise profile |

Additional annual lines:
- Domain: `600 - 3,000 TRY`
- SSL: `0 - 6,000 TRY`
- Security/pentest: `120,000 - 450,000 TRY`
- Load-test campaign: `30,000 - 150,000 TRY`

## 6) Execution Control Checklist

- `pnpm agent:status`
- `pnpm agent:next`
- `pnpm ops:wave2:status`
- `pnpm ops:conflicts`
- `pnpm quality:gate`

Gate close rule:
- Do not close a gate unless both technical evidence docs and command outputs are attached in `agent-ops/ops/`.
