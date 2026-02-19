# QA Strategy Baseline (F-000)

Date: 2026-02-19
Owner: QA

## Quality Gates

1. Build gate: `pnpm build` must pass.
2. Type gate: `pnpm typecheck` must pass.
3. Lint gate: `pnpm lint` must pass (warnings tracked).
4. Unit gate: core modules and API critical paths covered.
5. E2E gate: auth, project CRUD, estimation session, analyzer flow.

## Test Matrix

| Layer | Tool | Minimum Coverage |
|---|---|---|
| Estimation algorithms | Vitest | Already high (target keep >=90%) |
| API routers/services | Vitest | Critical router coverage required |
| Web critical flows | Playwright | Auth + project + session + analyzer |
| Security checks | Checklist + test cases | OWASP top risks no critical open |
| Performance checks | Lighthouse + API p95 sample | Baseline report required |

## Release Blocking Criteria

- Any failed build/typecheck/lint/test job blocks release.
- Any critical security issue blocks release.
- Missing smoke test execution blocks release.

## Immediate QA Actions

1. Add API test scaffold under `apps/api/src/**/__tests__`.
2. Add Playwright scaffold under `apps/web/e2e`.
3. Add CI jobs for API tests and E2E runs.
