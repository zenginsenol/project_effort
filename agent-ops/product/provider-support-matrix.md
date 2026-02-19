# Provider Support Matrix (E-001)

Date: 2026-02-19
Owner: Manager

## Decision

Connect flow is limited to providers with usable backend foundation.

## Supported Now (Visible in Connect Flow)

| Provider | Status | Notes |
|---|---|---|
| Jira | Supported (Baseline) | OAuth + import/export base exists |
| GitHub | Supported (Baseline) | OAuth + issue import base exists |

## Planned (Hidden from Connect Flow)

| Provider | Status | Reason |
|---|---|---|
| Azure DevOps | Planned | Implementation incomplete |
| GitLab | Planned | Implementation incomplete |

## UI Policy

- Unsupported/planned providers must not appear as actionable "Connect".
- Planned providers may appear as informational roadmap cards.

## Follow-up

When a planned provider is production-ready:
1. Enable in API validation and integration router.
2. Enable card in integrations UI connect flow.
3. Add provider-specific test cases and smoke checks.
