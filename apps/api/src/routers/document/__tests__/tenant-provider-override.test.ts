import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encrypt } from '../../../services/crypto';
import { documentRouter } from '../router';

const { mockDb, extractTasksFromTextMock, extractWithMultipleProvidersMock } = vi.hoisted(() => ({
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    update: vi.fn(),
  },
  extractTasksFromTextMock: vi.fn(),
  extractWithMultipleProvidersMock: vi.fn(),
}));

vi.mock('@estimate-pro/db', () => ({
  db: mockDb,
}));

vi.mock('../../../services/document/task-extractor', () => ({
  extractTasksFromText: extractTasksFromTextMock,
  extractWithMultipleProviders: extractWithMultipleProvidersMock,
}));

function createCaller() {
  return documentRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId: 'clerk_user_tenant',
    orgId: 'org_tenant',
  });
}

function mockSelectRows(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValue({ from });
}

function mockUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValue({ set });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.users.findFirst.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
  mockUpdateChain();
  extractTasksFromTextMock.mockResolvedValue({
    projectSummary: 'ok',
    totalEstimatedHours: 10,
    totalEstimatedCost: 1500,
    tasks: [],
    assumptions: [],
    provider: 'mock',
    model: 'mock',
    durationMs: 0,
  });
  extractWithMultipleProvidersMock.mockResolvedValue({
    results: [],
    errors: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('document router tenant/provider override guards', () => {
  it('does not use mismatched provider credentials for analyzeText provider override', async () => {
    mockSelectRows([{
      id: 'key-1',
      provider: 'openai',
      authMethod: 'api_key',
      encryptedKey: encrypt('sk-openai-abcdefghijklmnopqrstuvwxyz1234'),
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      model: 'gpt-5.2',
      reasoningEffort: 'medium',
      isActive: true,
    }]);

    const caller = createCaller();
    await caller.analyzeText({
      text: '1234567890 provider override security test',
      provider: 'anthropic',
      hourlyRate: 150,
    });

    // 4th arg = resolved aiConfig. It must be null when provider mismatches.
    expect(extractTasksFromTextMock).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      150,
      null,
    );
  });

  it('returns missing_config when comparative analyze cannot resolve requested provider safely', async () => {
    mockSelectRows([{
      id: 'key-2',
      provider: 'openai',
      authMethod: 'api_key',
      encryptedKey: encrypt('sk-openai-abcdefghijklmnopqrstuvwxyz5678'),
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      model: 'gpt-5.2',
      reasoningEffort: 'medium',
      isActive: true,
    }]);

    const caller = createCaller();
    const result = await caller.comparativeAnalyze({
      text: '1234567890 comparative mismatch test',
      hourlyRate: 150,
      providers: [{
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        reasoningEffort: 'medium',
      }],
    });

    expect(extractWithMultipleProvidersMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.summary).toMatchObject({
      requestedProviders: 1,
      resolvedProviders: 0,
      successfulProviders: 0,
      missingConfigProviders: 1,
    });
    expect(result.errors[0]).toMatchObject({
      provider: 'anthropic',
      code: 'missing_config',
    });
  });
});
