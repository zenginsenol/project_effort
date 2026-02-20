import { describe, expect, it } from 'vitest';

import type { ExtractionResult } from '../../../services/document/task-extractor';
import {
  buildComparativeAnalyzeResponse,
  type ComparativeAnalyzeError,
} from '../router';

function makeResult(provider: string, model: string): ExtractionResult {
  return {
    projectSummary: `${provider} summary`,
    totalEstimatedHours: 10,
    totalEstimatedCost: 1500,
    tasks: [],
    assumptions: [],
    provider,
    model,
    durationMs: 1000,
  };
}

describe('document comparativeAnalyze contract', () => {
  it('returns success status with deterministic summary when all providers succeed', () => {
    const response = buildComparativeAnalyzeResponse({
      requestedProviders: 2,
      resolvedProviders: 2,
      results: [makeResult('openai', 'gpt-5.2'), makeResult('anthropic', 'claude-sonnet-4-6')],
      errors: [],
    });

    expect(response.status).toBe('success');
    expect(response.summary).toMatchObject({
      requestedProviders: 2,
      resolvedProviders: 2,
      successfulProviders: 2,
      failedProviders: 0,
      missingConfigProviders: 0,
    });
    expect(response.summary.message).toContain('completed successfully');
  });

  it('returns partial_success with sorted coded errors for mixed outcomes', () => {
    const errors: ComparativeAnalyzeError[] = [
      {
        provider: 'openai',
        model: 'gpt-5.2',
        error: 'quota exceeded',
        code: 'provider_error',
      },
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        error: 'missing key',
        code: 'missing_config',
      },
    ];

    const response = buildComparativeAnalyzeResponse({
      requestedProviders: 3,
      resolvedProviders: 2,
      results: [makeResult('openrouter', 'openai/gpt-5.2')],
      errors,
    });

    expect(response.status).toBe('partial_success');
    expect(response.summary).toMatchObject({
      requestedProviders: 3,
      resolvedProviders: 2,
      successfulProviders: 1,
      failedProviders: 1,
      missingConfigProviders: 1,
    });
    expect(response.errors.map((error) => error.provider)).toEqual(['anthropic', 'openai']);
  });

  it('returns failed status when no provider succeeds', () => {
    const response = buildComparativeAnalyzeResponse({
      requestedProviders: 2,
      resolvedProviders: 0,
      results: [],
      errors: [{
        provider: 'openai',
        model: 'gpt-5.2',
        error: 'missing key',
        code: 'missing_config',
      }],
    });

    expect(response.status).toBe('failed');
    expect(response.summary.successfulProviders).toBe(0);
    expect(response.summary.message).toContain('failed');
  });
});
