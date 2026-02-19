# Performance Baseline Report (F-005)

Date: 2026-02-19  
Owner: QA

## Scope

- Web baseline: Next.js production build output
- API baseline: `/health` latency sample (autocannon)

## Web Baseline (from latest `pnpm --filter @estimate-pro/web build`)

- First Load JS (shared): ~102 kB
- Key routes:
  - `/dashboard`: 2.34 kB page payload
  - `/dashboard/projects/[projectId]`: 5.69 kB page payload
  - `/dashboard/analytics`: 4.15 kB page payload
  - `/dashboard/sessions/[sessionId]`: 4.30 kB page payload
  - `/dashboard/settings`: 2.87 kB page payload

## API Baseline (autocannon)

Command:
- `pnpm dlx autocannon -c 25 -d 10 http://127.0.0.1:4000/health`

Results:
- Latency p50: 0 ms
- Latency p99: 1 ms
- Latency avg: 0.12 ms
- Max latency: 32 ms
- Throughput avg: 30,942 req/s

## Assessment

- API p95/p99 for health endpoint is comfortably below target thresholds.
- Web bundle sizes are acceptable for current feature scope.
- Follow-up recommended: Lighthouse run on deployed staging URL with authenticated dashboard flow.

## Result

Performance baseline captured and linked to tracker for release readiness.
