# Monitoring & Alerting Runbook (G-003)

Date: 2026-02-19  
Owner: Ops

## Observability Targets

1. Availability
- Web uptime
- API uptime (`/health`)

2. Latency
- API p95 by route
- tRPC error rate

3. Infrastructure
- DB CPU/memory/storage
- Redis memory/evictions/connections

4. Application errors
- 5xx error rate
- Unhandled exceptions

## Alert Rules (minimum)

1. Critical
- API health check failing for 5 minutes
- DB unavailable
- Redis unavailable

2. High
- API p95 > 750ms for 10 minutes
- 5xx error rate > 2% for 10 minutes

3. Medium
- Disk usage > 80%
- Memory pressure > 85%

## Notification Routing

- Primary: on-call channel (`#estimatepro-oncall`)
- Secondary: email distribution (`ops@estimatepro`)
- Escalation: manager after 15 minutes unresolved critical

## Log Retention

- Application logs: 30 days hot storage
- Audit/security logs: 90 days
- Backup of critical incident logs: 1 year

## Runbook Actions

1. Confirm alert signal in dashboard
2. Correlate with deploy/version timeline
3. Check API `/health`
4. Check DB + Redis service status
5. Rollback to previous deployment if needed
6. Publish incident update every 15 minutes

## Result

Monitoring/alerting baseline and incident response routing are defined and ready to configure in production tooling.
