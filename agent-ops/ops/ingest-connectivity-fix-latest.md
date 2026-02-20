# Ingest Connectivity Fix - Latest

Date: 2026-02-20
Scope: Resolve hardcoded API endpoints that broke ingest and realtime flows outside local dev.

## Problem

Web app was calling API and socket endpoints with fixed `http://localhost:4000` values:
- tRPC client base
- analyzer file upload endpoint
- session realtime socket endpoint

This caused failures in staging/production and in environments where web and API run on different hosts.

## Implemented Fix

1. Added central API URL resolver:
- File: `apps/web/src/lib/api-url.ts`
- Functions:
  - `getApiBaseUrl()`
  - `getApiUrl(path)`

2. Replaced hardcoded URLs:
- `apps/web/src/lib/trpc.ts` -> `getApiUrl('/trpc')`
- `apps/web/src/app/dashboard/analyzer/page.tsx` -> `getApiUrl('/api/analyze-document')`
- `apps/web/src/app/dashboard/sessions/[sessionId]/page.tsx` -> `io(getApiBaseUrl())`

3. Env/documentation updates:
- `.env.example` -> added `NEXT_PUBLIC_API_URL`
- `.env.staging.example` -> added `NEXT_PUBLIC_API_URL`
- `.env.production.example` -> added `NEXT_PUBLIC_API_URL`
- `README.md` -> documented `NEXT_PUBLIC_API_URL`
- `CLAUDE.md` -> documented `NEXT_PUBLIC_API_URL`

## URL Resolution Logic

- If `NEXT_PUBLIC_API_URL` is set, it is always used.
- In browser local dev (`localhost` / `127.0.0.1`), fallback is `http(s)://<host>:4000`.
- Otherwise fallback is same-origin (`window.location.origin`).
- Server-side fallback remains `http://localhost:4000`.

## Verification

- `pnpm --filter @estimate-pro/web lint` -> pass
- `pnpm --filter @estimate-pro/web typecheck` -> pass
- `pnpm --filter @estimate-pro/web build` -> pass
- Runtime smoke (`pnpm start --port 3200 --hostname 127.0.0.1`):
  - `GET /dashboard/analyzer` -> `HTTP/1.1 200 OK`
  - `GET /dashboard/sessions` -> `HTTP/1.1 200 OK`
