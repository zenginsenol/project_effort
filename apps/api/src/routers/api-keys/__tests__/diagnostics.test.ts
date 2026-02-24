import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';

import { encrypt } from '../../../services/crypto';
import { apiKeysRouter } from '../router';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      apiKeys: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@estimate-pro/db', () => ({
  db: mockDb,
}));

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
} as unknown as Redis;

function createCaller() {
  return apiKeysRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId: 'clerk_user_diagnostics',
    orgId: 'org-diagnostics',
    redis: mockRedis,
  });
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
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiKeysRouter diagnostics', () => {
  it('returns provider health and OpenRouter quota data', async () => {
    const where = vi.fn().mockResolvedValue([
      {
        provider: 'openai',
        model: 'gpt-5.2-codex',
        isActive: true,
        authMethod: 'api_key',
        lastUsedAt: null,
      },
      {
        provider: 'openrouter',
        model: 'openai/gpt-5.2',
        isActive: true,
        authMethod: 'api_key',
        lastUsedAt: null,
      },
    ]);
    const from = vi.fn().mockReturnValue({ where });
    mockDb.select.mockReturnValue({ from });

    mockDb.query.apiKeys.findFirst
      .mockResolvedValueOnce({
        id: '22222222-2222-4222-8222-222222222222',
        provider: 'openai',
        authMethod: 'api_key',
        encryptedKey: encrypt('sk-openai-abcdefghijklmnopqrstuvwxyz1234'),
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        model: 'gpt-5.2-codex',
      })
      .mockResolvedValueOnce({
        id: '33333333-3333-4333-8333-333333333333',
        provider: 'openrouter',
        authMethod: 'api_key',
        encryptedKey: encrypt('sk-or-v1-abcdefghijklmnopqrstuvwxyz1234'),
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        model: 'openai/gpt-5.2',
      });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '{"id":"chatcmpl_1"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '{"id":"openrouter_1"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            label: 'Primary OR Key',
            usage: 12.5,
            limit: 100,
            limit_remaining: 87.5,
            is_free_tier: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            total_credits: 500,
            total_usage: 112.5,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const caller = createCaller();
    const result = await caller.diagnostics();

    expect(result.providers).toHaveLength(3);

    const openai = result.providers.find((provider) => provider.provider === 'openai');
    expect(openai).toMatchObject({
      configured: true,
      active: true,
      status: 'ok',
      model: 'gpt-5.2-codex',
      authMethod: 'api_key',
    });

    const anthropic = result.providers.find((provider) => provider.provider === 'anthropic');
    expect(anthropic).toMatchObject({
      configured: false,
      active: false,
      status: 'not_configured',
      model: null,
    });

    const openrouter = result.providers.find((provider) => provider.provider === 'openrouter');
    expect(openrouter).toMatchObject({
      configured: true,
      active: true,
      status: 'ok',
      model: 'openai/gpt-5.2',
      authMethod: 'api_key',
      quota: {
        status: 'available',
        remainingUsd: 87.5,
        limitUsd: 100,
        usageUsd: 12.5,
        totalCreditsUsd: 500,
        totalUsageUsd: 112.5,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
