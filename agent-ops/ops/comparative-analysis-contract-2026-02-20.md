# Comparative Analysis API Contract (H-006)

Date: 2026-02-20  
Owner: Agent-A  
Status: implemented

## Scope

Endpoint: `document.comparativeAnalyze` (tRPC mutation)

Goals:
1. Deterministic response envelope for all outcomes.
2. Stable error typing for missing-config vs provider-runtime vs internal failures.
3. Frontend-safe summary fields for direct rendering without ad-hoc branching.

## Request Shape

```json
{
  "text": "<requirements text>",
  "projectContext": "optional context",
  "hourlyRate": 150,
  "providers": [
    {
      "provider": "openai",
      "model": "gpt-5.2",
      "reasoningEffort": "medium"
    },
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "reasoningEffort": "high"
    }
  ]
}
```

## Response Envelope

```ts
type ComparativeAnalyzeStatus = 'success' | 'partial_success' | 'failed';
type ComparativeAnalyzeErrorCode = 'missing_config' | 'provider_error' | 'internal_error';

interface ComparativeAnalyzeError {
  provider: string;
  model: string;
  error: string;
  code: ComparativeAnalyzeErrorCode;
}

interface ComparativeAnalyzeSummary {
  requestedProviders: number;
  resolvedProviders: number;
  successfulProviders: number;
  failedProviders: number;
  missingConfigProviders: number;
  message: string;
}

interface ComparativeAnalyzeResponse {
  status: ComparativeAnalyzeStatus;
  results: ExtractionResult[];
  errors: ComparativeAnalyzeError[];
  summary: ComparativeAnalyzeSummary;
}
```

## Examples

### 1) Full success

```json
{
  "status": "success",
  "results": [
    { "provider": "openai", "model": "gpt-5.2", "totalEstimatedHours": 120, "tasks": [] },
    { "provider": "anthropic", "model": "claude-sonnet-4-6", "totalEstimatedHours": 132, "tasks": [] }
  ],
  "errors": [],
  "summary": {
    "requestedProviders": 2,
    "resolvedProviders": 2,
    "successfulProviders": 2,
    "failedProviders": 0,
    "missingConfigProviders": 0,
    "message": "Comparative analysis completed successfully for 2/2 providers."
  }
}
```

### 2) Partial success (mixed outcome)

```json
{
  "status": "partial_success",
  "results": [
    { "provider": "openrouter", "model": "openai/gpt-5.2", "totalEstimatedHours": 118, "tasks": [] }
  ],
  "errors": [
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "error": "No active API key found for anthropic. Please add a key in Settings.",
      "code": "missing_config"
    },
    {
      "provider": "openai",
      "model": "gpt-5.2",
      "error": "Rate limit exceeded",
      "code": "provider_error"
    }
  ],
  "summary": {
    "requestedProviders": 3,
    "resolvedProviders": 2,
    "successfulProviders": 1,
    "failedProviders": 1,
    "missingConfigProviders": 1,
    "message": "Comparative analysis completed with partial success: 1 succeeded, 1 failed, 1 missing configuration."
  }
}
```

### 3) Failed (no provider succeeded)

```json
{
  "status": "failed",
  "results": [],
  "errors": [
    {
      "provider": "openai",
      "model": "gpt-5.2",
      "error": "No active API key found for openai. Please add a key in Settings.",
      "code": "missing_config"
    }
  ],
  "summary": {
    "requestedProviders": 1,
    "resolvedProviders": 0,
    "successfulProviders": 0,
    "failedProviders": 0,
    "missingConfigProviders": 1,
    "message": "Comparative analysis failed: no provider succeeded. 0 failed, 1 missing configuration."
  }
}
```

## Determinism Rules

1. Envelope fields are always present: `status`, `results`, `errors`, `summary`.
2. Errors are sorted deterministically by `provider`, then `model`, then `code`.
3. Missing configuration never throws transport errors; it is returned in `errors[]` with `code=missing_config`.
4. Unexpected runtime failures are normalized as `code=internal_error` with `provider=system`.

## Test Evidence

1. `apps/api/src/routers/document/__tests__/comparative-contract.test.ts`
2. `pnpm --filter @estimate-pro/api test -- src/routers/document/__tests__/comparative-contract.test.ts`
3. Result: 3/3 tests passed.
