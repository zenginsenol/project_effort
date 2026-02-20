# Pre-Prod Rehearsal + Rollback Drill (H-013)

Date: 2026-02-20  
Owner: Ops  
Status: completed

## Scope

Local pre-prod mirror rehearsal to validate deployment sequence, runtime smoke checks, and rollback execution timing.

## Rehearsal Steps

1. Build release artifacts.
2. Start API service.
3. Validate API health endpoint.
4. Start Web service.
5. Validate dashboard route.
6. Execute rollback drill by terminating both services.
7. Verify endpoints are no longer reachable post-rollback.

## Command Summary

1. `pnpm build`
2. `pnpm --filter @estimate-pro/api start`
3. `pnpm --filter @estimate-pro/web exec next start -p 3100 -H 127.0.0.1`
4. Probes:
   - `GET http://127.0.0.1:4000/health`
   - `GET http://127.0.0.1:3100/dashboard`
5. Rollback probe after stop:
   - same endpoints expected `000` (connection closed)

## Timing Results

1. Build: `2s`
2. API boot to healthy: `2s`
3. Web boot to reachable route: `2s`
4. Rollback execution (stop phase): `0s` (sub-second)
5. End-to-end rehearsal total: `6s`

## Smoke Outcomes

1. API health response code: `200`
2. Web dashboard response code: `200`
3. Post-rollback API response code: `000`
4. Post-rollback Web response code: `000`

## SLO Check

1. Rehearsal deployment + smoke completed within expected operator window.
2. Rollback action completed immediately and services fully stopped.

## Notes

1. This run is a local mirror rehearsal; production-grade pre-prod rehearsal still requires target infra parity environment execution.
2. No blocking failure observed in application startup or rollback path.
