import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@estimate-pro/db', () => ({
  db: mockDb,
}));

function createCaller() {
  return apiKeysRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId: 'clerk_user_openrouter',
    orgId: 'org-openrouter',
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
});

describe('apiKeysRouter openrouter flows', () => {
  it('adds a new OpenRouter key with provider/model metadata', async () => {
    mockDb.query.apiKeys.findFirst.mockResolvedValueOnce(null);

    const returning = vi.fn().mockResolvedValue([{
      id: '22222222-2222-4222-8222-222222222222',
      provider: 'openrouter',
      keyHint: '...1234',
      label: 'OpenRouter API Key',
      model: 'openai/gpt-5.2',
    }]);
    const values = vi.fn().mockReturnValue({ returning });
    mockDb.insert.mockReturnValue({ values });

    const caller = createCaller();
    const result = await caller.add({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234',
      model: 'openai/gpt-5.2',
    });

    expect(result).toMatchObject({
      provider: 'openrouter',
      model: 'openai/gpt-5.2',
      updated: false,
    });
    expect(values).toHaveBeenCalledTimes(1);
  });

  it('rejects OpenRouter model updates that are not provider/model formatted', async () => {
    mockDb.query.apiKeys.findFirst.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      provider: 'openrouter',
      model: 'openai/gpt-5.2',
    });

    const caller = createCaller();

    await expect(caller.update({
      id: '33333333-3333-4333-8333-333333333333',
      model: 'gpt-5.2',
    })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'OpenRouter model must be in provider/model format (example: openai/gpt-5.2).',
    });

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('returns decrypted OpenRouter key via getKeyForProvider', async () => {
    const rawKey = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz5678';
    mockDb.query.apiKeys.findFirst.mockResolvedValueOnce({
      id: '44444444-4444-4444-8444-444444444444',
      provider: 'openrouter',
      authMethod: 'api_key',
      encryptedKey: encrypt(rawKey),
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      model: 'openai/gpt-5.2',
    });

    const caller = createCaller();
    const result = await caller.getKeyForProvider({ provider: 'openrouter' });

    expect(result).toEqual({
      found: true,
      apiKey: rawKey,
      model: 'openai/gpt-5.2',
      authMethod: 'api_key',
      oauthBetaHeader: null,
    });
  });

  it('returns found=false when DB returns a provider different from requested', async () => {
    mockDb.query.apiKeys.findFirst.mockResolvedValueOnce({
      id: '55555555-5555-4555-8555-555555555555',
      provider: 'openai',
      authMethod: 'api_key',
      encryptedKey: encrypt('sk-openai-abcdefghijklmnopqrstuvwxyz9012'),
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      model: 'gpt-5.2',
    });

    const caller = createCaller();
    const result = await caller.getKeyForProvider({ provider: 'openrouter' });

    expect(result).toEqual({
      found: false,
      apiKey: null,
      model: null,
      authMethod: null,
      oauthBetaHeader: null,
    });
  });
});
