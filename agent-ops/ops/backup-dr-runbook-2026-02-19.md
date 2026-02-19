# Backup & Disaster Recovery Runbook (G-004)

Date: 2026-02-19  
Owner: Ops

## RPO / RTO Targets

- RPO: <= 15 minutes
- RTO: <= 2 hours

## Backup Plan

1. PostgreSQL
- Daily full snapshot
- 15-minute WAL/incremental backups
- Retention: 30 days

2. Redis
- AOF/RDB backups every 15 minutes
- Retention: 7 days

3. Config/Secrets
- Infrastructure config snapshots per release
- Secret manager versioning enabled

## Restore Drill Procedure

1. Provision isolated restore environment
2. Restore latest PostgreSQL snapshot
3. Replay WAL to target timestamp
4. Restore Redis snapshot
5. Run application smoke checks
6. Validate data integrity (sample projects/tasks/sessions)
7. Record duration and variance from RTO target

## Validation Command Checklist

- `pnpm db:push` (schema alignment)
- `pnpm quality:gate` (application sanity)
- API health: `GET /health`

## Drill Log Template

- Drill date/time
- Snapshot timestamp used
- Restore duration (DB, Redis, app)
- Data integrity checks passed/failed
- Corrective actions

## Result

Backup and disaster recovery process is documented with measurable restore objectives and repeatable drill steps.
