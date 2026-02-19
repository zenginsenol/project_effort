# Release Checklist, Go-Live Runbook, Rollback Plan (G-005)

Date: 2026-02-19  
Owner: Manager / Ops

## Pre-Release Checklist

- [x] Quality gate passes (`pnpm quality:gate`)
- [x] Security checklist completed (OWASP report)
- [x] API router tests + E2E smoke/critical flows passing
- [x] Staging parity validated
- [x] Production env template prepared
- [x] Monitoring/alerting runbook prepared
- [x] Backup/DR runbook prepared

## Go-Live Steps

1. Freeze deploy window and announce start.
2. Apply database migrations:
   - `pnpm db:push`
3. Deploy API build.
4. Deploy Web build.
5. Run post-deploy smoke checks:
   - API `/health`
   - Dashboard route load
   - Project page load
   - Session page load
6. Enable monitoring alerts and confirm green dashboards.
7. Announce release complete.

## Rollback Plan

1. Trigger rollback if any critical smoke check fails.
2. Revert web/api deployment to previous version.
3. Restore DB snapshot only if irreversible migration impact detected.
4. Confirm `/health` and core routes after rollback.
5. Publish incident + recovery timeline.

## Exit Criteria

- All smoke checks pass
- No critical alerts in first 30 minutes
- On-call handoff completed
