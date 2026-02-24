import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createHash } from 'node:crypto';

import { db } from '@estimate-pro/db';
import { apiKeys, users } from '@estimate-pro/db/schema';

import { authedProcedure, router } from '../../trpc/trpc';
import { encrypt, decrypt, getKeyHint } from '../../services/crypto';
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  getCallbackUrl,
  resolveOAuthMode,
  startCallbackServer,
} from '../../services/oauth/openai-oauth';
import type { OAuthResult } from '../../services/oauth/openai-oauth';
import {
  upsertOpenAIOAuthCredential,
  upsertClaudeOAuthCredential,
  upsertClaudeMaxOAuthCredential,
} from '../../services/oauth/oauth-credential-store';
import { storePendingFlow, getPendingFlow, removePendingFlow } from '../../services/oauth/oauth-store';
import {
  generateClaudePKCE,
  generateClaudeState,
  buildClaudeAuthorizationUrl,
  exchangeClaudeCodeForTokens,
  refreshClaudeAccessToken,
  validateSetupKey,
  CLAUDE_OAUTH_BETA_HEADER,
} from '../../services/oauth/claude-oauth';

import {
  addApiKeyInput,
  updateApiKeyInput,
  deleteApiKeyInput,
  getApiKeyForProviderInput,
  listOpenRouterModelsInput,
} from './schema';

/**
 * Resolve the DB user UUID from the clerkId stored in ctx.userId
 */
async function resolveUserDbId(clerkId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, clerkId),
  });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found in database' });
  }
  return user.id;
}

/**
 * Get provider display name
 */
function getProviderLabel(provider: string): string {
  switch (provider) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic Claude';
    case 'openrouter': return 'OpenRouter';
    default: return provider;
  }
}

function validateModelForProvider(provider: string, model?: string | null): void {
  if (!model) {
    return;
  }

  const normalized = model.trim();
  if (!normalized) {
    return;
  }

  if (provider === 'openrouter' && !normalized.includes('/')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'OpenRouter model must be in provider/model format (example: openai/gpt-5.2).',
    });
  }

  if (provider === 'openai' && normalized.includes('/')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'OpenAI model must be a direct model id (example: gpt-5.2).',
    });
  }

  if (provider === 'anthropic' && !normalized.startsWith('claude-')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Anthropic model must start with claude- prefix.',
    });
  }
}

type OpenRouterModelSummary = {
  id: string;
  name: string;
  description: string | null;
  contextLength: number | null;
  supportsReasoning: boolean;
};

type Provider = 'openai' | 'anthropic' | 'openrouter';
type ProviderHealthStatus = 'ok' | 'error' | 'inactive' | 'not_configured';
type ProviderAuthMethod = 'api_key' | 'oauth';

type ProviderQuota = {
  status: 'available' | 'unavailable' | 'error';
  remainingUsd: number | null;
  limitUsd: number | null;
  usageUsd: number | null;
  totalCreditsUsd: number | null;
  totalUsageUsd: number | null;
  note: string | null;
};

type ProviderDiagnostic = {
  provider: Provider;
  configured: boolean;
  active: boolean;
  status: ProviderHealthStatus;
  model: string | null;
  authMethod: ProviderAuthMethod | null;
  latencyMs: number | null;
  message: string;
  lastUsedAt: Date | null;
  quota: ProviderQuota | null;
};

const PROVIDERS: Provider[] = ['openai', 'anthropic', 'openrouter'];
const DEFAULT_MODEL_BY_PROVIDER: Record<Provider, string> = {
  openai: 'gpt-5.2-codex',
  anthropic: 'claude-sonnet-4-6',
  openrouter: 'openai/gpt-5.2',
};

function extractChatGPTAccountId(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    const authPayload = record['https://api.openai.com/auth'];
    if (record.chatgpt_account_id && typeof record.chatgpt_account_id === 'string') {
      return record.chatgpt_account_id;
    }
    if (record.account_id && typeof record.account_id === 'string') {
      return record.account_id;
    }
    if (authPayload && typeof authPayload === 'object' && !Array.isArray(authPayload)) {
      const maybeAccountId = (authPayload as Record<string, unknown>).account_id;
      if (typeof maybeAccountId === 'string') {
        return maybeAccountId;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isLikelyOpenAIReasoningModel(model: string): boolean {
  return model.includes('codex')
    || model.startsWith('gpt-5')
    || model.startsWith('o3')
    || model.startsWith('o4');
}

async function readProviderError(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) {
    return fallback;
  }
  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    if (payload.error && typeof payload.error === 'object' && !Array.isArray(payload.error)) {
      const error = payload.error as Record<string, unknown>;
      if (typeof error.message === 'string' && error.message.trim().length > 0) {
        return error.message.trim();
      }
    }
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message.trim();
    }
    return text.slice(0, 280);
  } catch {
    return text.slice(0, 280);
  }
}

async function pingOpenAIModel(input: {
  authMethod: ProviderAuthMethod;
  token: string;
  model: string;
}): Promise<{ latencyMs: number; message: string }> {
  const startedAt = Date.now();

  if (input.authMethod === 'oauth') {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    };
    const accountId = extractChatGPTAccountId(input.token);
    if (accountId) {
      headers['chatgpt-account-id'] = accountId;
    }

    const response = await fetch('https://chatgpt.com/backend-api/codex/responses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.model,
        instructions: 'Reply with exactly: ok',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'ping' }] }],
        stream: true,
        store: false,
      }),
    });

    if (!response.ok) {
      throw new Error(await readProviderError(
        response,
        `ChatGPT backend request failed (${response.status})`,
      ));
    }

    await response.text();
    return {
      latencyMs: Date.now() - startedAt,
      message: 'ChatGPT subscription token and model are reachable.',
    };
  }

  const requestBody: Record<string, unknown> = {
    model: input.model,
    messages: [{ role: 'user', content: 'ping' }],
    temperature: 0,
  };

  if (isLikelyOpenAIReasoningModel(input.model)) {
    requestBody.max_completion_tokens = 1;
  } else {
    requestBody.max_tokens = 1;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(await readProviderError(
      response,
      `OpenAI request failed (${response.status})`,
    ));
  }

  await response.text();
  return {
    latencyMs: Date.now() - startedAt,
    message: 'OpenAI API key and model are reachable.',
  };
}

async function pingAnthropicModel(input: {
  authMethod: ProviderAuthMethod;
  token: string;
  model: string;
}): Promise<{ latencyMs: number; message: string }> {
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  if (input.authMethod === 'oauth') {
    headers.Authorization = `Bearer ${input.token}`;
    headers['anthropic-beta'] = CLAUDE_OAUTH_BETA_HEADER;
  } else {
    headers['x-api-key'] = input.token;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: input.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });

  if (!response.ok) {
    throw new Error(await readProviderError(
      response,
      `Anthropic request failed (${response.status})`,
    ));
  }

  await response.text();
  return {
    latencyMs: Date.now() - startedAt,
    message: 'Anthropic credential and model are reachable.',
  };
}

async function pingOpenRouterModel(input: {
  token: string;
  model: string;
}): Promise<{ latencyMs: number; message: string }> {
  const startedAt = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });

  if (!response.ok) {
    throw new Error(await readProviderError(
      response,
      `OpenRouter request failed (${response.status})`,
    ));
  }

  await response.text();
  return {
    latencyMs: Date.now() - startedAt,
    message: 'OpenRouter key and model are reachable.',
  };
}

async function fetchOpenRouterQuota(token: string): Promise<ProviderQuota> {
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    const keyResponse = await fetch('https://openrouter.ai/api/v1/key', { headers });
    if (!keyResponse.ok) {
      return {
        status: 'error',
        remainingUsd: null,
        limitUsd: null,
        usageUsd: null,
        totalCreditsUsd: null,
        totalUsageUsd: null,
        note: await readProviderError(
          keyResponse,
          `OpenRouter quota endpoint failed (${keyResponse.status})`,
        ),
      };
    }

    const keyPayload = await keyResponse.json() as Record<string, unknown>;
    const keyData = (
      keyPayload.data
      && typeof keyPayload.data === 'object'
      && !Array.isArray(keyPayload.data)
    )
      ? keyPayload.data as Record<string, unknown>
      : {};

    let totalCreditsUsd: number | null = null;
    let totalUsageUsd: number | null = null;

    try {
      const creditsResponse = await fetch('https://openrouter.ai/api/v1/credits', { headers });
      if (creditsResponse.ok) {
        const creditsPayload = await creditsResponse.json() as Record<string, unknown>;
        const creditsData = (
          creditsPayload.data
          && typeof creditsPayload.data === 'object'
          && !Array.isArray(creditsPayload.data)
        )
          ? creditsPayload.data as Record<string, unknown>
          : {};

        totalCreditsUsd = numberOrNull(creditsData.total_credits);
        totalUsageUsd = numberOrNull(creditsData.total_usage);
      }
    } catch {
      // Ignore credits endpoint failures. /key still gives remaining/usage details.
    }

    const label = typeof keyData.label === 'string' ? keyData.label : null;
    const isFreeTier = typeof keyData.is_free_tier === 'boolean' ? keyData.is_free_tier : null;

    return {
      status: 'available',
      remainingUsd: numberOrNull(keyData.limit_remaining),
      limitUsd: numberOrNull(keyData.limit),
      usageUsd: numberOrNull(keyData.usage),
      totalCreditsUsd,
      totalUsageUsd,
      note: label
        ? `Key: ${label}${isFreeTier ? ' (free tier)' : ''}`
        : (isFreeTier ? 'Free tier key' : null),
    };
  } catch (error) {
    return {
      status: 'error',
      remainingUsd: null,
      limitUsd: null,
      usageUsd: null,
      totalCreditsUsd: null,
      totalUsageUsd: null,
      note: error instanceof Error ? error.message : 'OpenRouter quota check failed.',
    };
  }
}

const OPENROUTER_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const openRouterModelCache = new Map<string, {
  expiresAt: number;
  models: OpenRouterModelSummary[];
}>();

function getOpenRouterCacheKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function parseOpenRouterModel(raw: unknown): OpenRouterModelSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const model = raw as Record<string, unknown>;
  const id = typeof model.id === 'string' ? model.id.trim() : '';
  if (!id) {
    return null;
  }

  const name = typeof model.name === 'string' && model.name.trim().length > 0
    ? model.name.trim()
    : id;
  const description = typeof model.description === 'string' && model.description.trim().length > 0
    ? model.description.trim()
    : null;
  const contextLength = typeof model.context_length === 'number' && Number.isFinite(model.context_length)
    ? model.context_length
    : typeof model.contextLength === 'number' && Number.isFinite(model.contextLength)
      ? model.contextLength
      : null;

  const supportedParameters = Array.isArray(model.supported_parameters)
    ? model.supported_parameters.filter((item): item is string => typeof item === 'string')
    : [];
  const supportsReasoning = supportedParameters.some((item) => (
    item.toLowerCase().includes('reason')
    || item.toLowerCase().includes('thinking')
  ));

  return {
    id,
    name,
    description,
    contextLength,
    supportsReasoning,
  };
}

async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModelSummary[]> {
  const cacheKey = getOpenRouterCacheKey(apiKey);
  const now = Date.now();
  const cacheHit = openRouterModelCache.get(cacheKey);
  if (cacheHit && cacheHit.expiresAt > now) {
    return cacheHit.models;
  }

  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `OpenRouter model list request failed (${response.status})`;
    try {
      const payload = JSON.parse(errorText) as { error?: { message?: string }; message?: string };
      message = payload.error?.message || payload.message || message;
    } catch {
      // ignore parse failure
    }
    throw new TRPCError({ code: 'BAD_GATEWAY', message });
  }

  const payload = await response.json() as { data?: unknown[] };
  const models = Array.isArray(payload.data)
    ? payload.data.map(parseOpenRouterModel).filter((item): item is OpenRouterModelSummary => item !== null)
    : [];

  models.sort((a, b) => a.id.localeCompare(b.id));
  openRouterModelCache.set(cacheKey, {
    expiresAt: now + OPENROUTER_MODEL_CACHE_TTL_MS,
    models,
  });

  return models;
}

export const apiKeysRouter = router({
  /**
   * List all API keys for the current user (keys are masked)
   */
  list: authedProcedure.query(async ({ ctx }) => {
    const userDbId = await resolveUserDbId(ctx.userId);

    const keys = await db
      .select({
        id: apiKeys.id,
        provider: apiKeys.provider,
        keyHint: apiKeys.keyHint,
        label: apiKeys.label,
        model: apiKeys.model,
        reasoningEffort: apiKeys.reasoningEffort,
        isActive: apiKeys.isActive,
        authMethod: apiKeys.authMethod,
        oauthEmail: apiKeys.oauthEmail,
        tokenExpiresAt: apiKeys.tokenExpiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userDbId));

    return keys;
  }),

  /**
   * Provider diagnostics:
   * - Verifies that each provider's active model is reachable
   * - Returns quota usage if the provider exposes it (OpenRouter)
   */
  diagnostics: authedProcedure.query(async ({ ctx }) => {
    const userDbId = await resolveUserDbId(ctx.userId);
    const keys = await db
      .select({
        provider: apiKeys.provider,
        model: apiKeys.model,
        isActive: apiKeys.isActive,
        authMethod: apiKeys.authMethod,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userDbId));

    const caller = apiKeysRouter.createCaller(ctx);

    const diagnostics = await Promise.all(PROVIDERS.map(async (provider): Promise<ProviderDiagnostic> => {
      const providerKeys = keys.filter((key) => key.provider === provider);
      const activeKey = providerKeys.find((key) => key.isActive);
      const fallbackKey = providerKeys[0];
      const selectedKey = activeKey ?? fallbackKey;

      if (!selectedKey) {
        return {
          provider,
          configured: false,
          active: false,
          status: 'not_configured',
          model: null,
          authMethod: null,
          latencyMs: null,
          message: 'No key configured.',
          lastUsedAt: null,
          quota: null,
        };
      }

      const model = selectedKey.model?.trim() || DEFAULT_MODEL_BY_PROVIDER[provider];
      const authMethod = selectedKey.authMethod === 'oauth' ? 'oauth' : 'api_key';

      if (!selectedKey.isActive) {
        return {
          provider,
          configured: true,
          active: false,
          status: 'inactive',
          model,
          authMethod,
          latencyMs: null,
          message: 'Key exists but is inactive.',
          lastUsedAt: selectedKey.lastUsedAt,
          quota: null,
        };
      }

      const keyForProvider = await caller.getKeyForProvider({ provider });
      if (!keyForProvider.found || !keyForProvider.apiKey) {
        return {
          provider,
          configured: true,
          active: true,
          status: 'error',
          model,
          authMethod,
          latencyMs: null,
          message: 'Active key could not be resolved.',
          lastUsedAt: selectedKey.lastUsedAt,
          quota: provider === 'openrouter'
            ? {
              status: 'error',
              remainingUsd: null,
              limitUsd: null,
              usageUsd: null,
              totalCreditsUsd: null,
              totalUsageUsd: null,
              note: 'OpenRouter key could not be resolved.',
            }
            : {
              status: 'unavailable',
              remainingUsd: null,
              limitUsd: null,
              usageUsd: null,
              totalCreditsUsd: null,
              totalUsageUsd: null,
              note: 'Provider does not expose remaining quota on standard API keys.',
            },
        };
      }

      const resolvedAuthMethod = keyForProvider.authMethod === 'oauth' ? 'oauth' : 'api_key';

      try {
        const health = provider === 'openai'
          ? await pingOpenAIModel({
            authMethod: resolvedAuthMethod,
            token: keyForProvider.apiKey,
            model,
          })
          : provider === 'anthropic'
            ? await pingAnthropicModel({
              authMethod: resolvedAuthMethod,
              token: keyForProvider.apiKey,
              model,
            })
            : await pingOpenRouterModel({
              token: keyForProvider.apiKey,
              model,
            });

        const quota = provider === 'openrouter'
          ? await fetchOpenRouterQuota(keyForProvider.apiKey)
          : {
            status: 'unavailable' as const,
            remainingUsd: null,
            limitUsd: null,
            usageUsd: null,
            totalCreditsUsd: null,
            totalUsageUsd: null,
            note: 'Provider does not expose remaining quota on standard API keys.',
          };

        return {
          provider,
          configured: true,
          active: true,
          status: 'ok',
          model,
          authMethod: resolvedAuthMethod,
          latencyMs: health.latencyMs,
          message: health.message,
          lastUsedAt: selectedKey.lastUsedAt,
          quota,
        };
      } catch (error) {
        const quota = provider === 'openrouter'
          ? await fetchOpenRouterQuota(keyForProvider.apiKey)
          : {
            status: 'unavailable' as const,
            remainingUsd: null,
            limitUsd: null,
            usageUsd: null,
            totalCreditsUsd: null,
            totalUsageUsd: null,
            note: 'Provider does not expose remaining quota on standard API keys.',
          };

        return {
          provider,
          configured: true,
          active: true,
          status: 'error',
          model,
          authMethod: resolvedAuthMethod,
          latencyMs: null,
          message: error instanceof Error ? error.message : 'Health check failed.',
          lastUsedAt: selectedKey.lastUsedAt,
          quota,
        };
      }
    }));

    return {
      checkedAt: new Date(),
      providers: diagnostics,
    };
  }),

  /**
   * List OpenRouter models for the current user's key (or a pasted key).
   * Used by Settings UI to provide searchable model picker.
   */
  listOpenRouterModels: authedProcedure
    .input(listOpenRouterModelsInput)
    .query(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);

      let resolvedApiKey = input.apiKey?.trim() || '';
      if (!resolvedApiKey) {
        const existing = await db.query.apiKeys.findFirst({
          where: and(
            eq(apiKeys.userId, userDbId),
            eq(apiKeys.provider, 'openrouter'),
            eq(apiKeys.isActive, true),
          ),
        });

        if (!existing?.encryptedKey) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'OpenRouter API key is required. Paste a key or save one in Settings.',
          });
        }
        resolvedApiKey = decrypt(existing.encryptedKey);
      }

      const allModels = await fetchOpenRouterModels(resolvedApiKey);
      const normalizedQuery = input.query?.trim().toLowerCase() || '';
      const limit = input.limit ?? 2000;

      const models = normalizedQuery.length === 0
        ? allModels
        : allModels.filter((model) => (
          model.id.toLowerCase().includes(normalizedQuery)
          || model.name.toLowerCase().includes(normalizedQuery)
          || (model.description?.toLowerCase().includes(normalizedQuery) ?? false)
        ));

      return {
        total: allModels.length,
        filtered: models.length,
        models: models.slice(0, limit),
      };
    }),

  /**
   * Add a new API key (manual entry) - supports openai, anthropic, openrouter
   */
  add: authedProcedure
    .input(addApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);
      validateModelForProvider(input.provider, input.model);

      // Check if user already has a key for this provider
      const existing = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.userId, userDbId),
          eq(apiKeys.provider, input.provider),
        ),
      });

      if (existing) {
        const encryptedKey = encrypt(input.apiKey);
        const keyHint = getKeyHint(input.apiKey);

        await db
          .update(apiKeys)
          .set({
            encryptedKey,
            keyHint,
            label: input.label ?? existing.label,
            model: input.model ?? existing.model,
            authMethod: 'api_key',
            encryptedAccessToken: null,
            encryptedRefreshToken: null,
            tokenExpiresAt: null,
            oauthEmail: null,
            isActive: true,
          })
          .where(eq(apiKeys.id, existing.id));

        return {
          id: existing.id,
          provider: input.provider,
          keyHint,
          label: input.label ?? existing.label,
          model: input.model ?? existing.model,
          updated: true,
        };
      }

      const encryptedKey = encrypt(input.apiKey);
      const keyHint = getKeyHint(input.apiKey);

      const [created] = await db
        .insert(apiKeys)
        .values({
          userId: userDbId,
          provider: input.provider,
          encryptedKey,
          keyHint,
          label: input.label || `${getProviderLabel(input.provider)} API Key`,
          model: input.model,
          authMethod: 'api_key',
        })
        .returning({
          id: apiKeys.id,
          provider: apiKeys.provider,
          keyHint: apiKeys.keyHint,
          label: apiKeys.label,
          model: apiKeys.model,
        });

      return { ...created, updated: false };
    }),

  /**
   * Start OpenAI OAuth login flow - returns URL to redirect user to.
   * Supports both local temp callback mode and API callback mode.
   */
  startOAuthLogin: authedProcedure
    .input(z.object({
      provider: z.enum(['openai']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.provider !== 'openai') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only OpenAI OAuth is supported' });
      }

      const { codeVerifier, codeChallenge } = generatePKCE();
      const state = generateState();
      const mode = resolveOAuthMode();
      const redirectUri = getCallbackUrl(mode);

      // Store PKCE state for callback verification
      storePendingFlow(state, {
        codeVerifier,
        userId: ctx.userId,
        redirectUri,
      });

      // Local mode: start temporary callback server on localhost:1455.
      // API callback mode: Fastify /auth/openai/callback route will handle completion.
      if (mode === 'local_temp_server') {
        try {
          await startCallbackServer({
            state,
            onComplete: async (result: OAuthResult) => {
              if (!result.ok) {
                console.error('[oauth] OAuth flow failed:', result.error);
                return;
              }

              try {
                const { tokens, userId } = result;
                const { email } = await upsertOpenAIOAuthCredential({
                  clerkUserId: userId,
                  tokens,
                  defaultModel: DEFAULT_MODEL_BY_PROVIDER.openai,
                  defaultReasoningEffort: 'medium',
                });
                console.log(`[oauth] Successfully stored OAuth tokens for user ${userId}${email ? ` (${email})` : ''}`);
              } catch (dbErr) {
                console.error('[oauth] Failed to store tokens in DB:', dbErr);
              }
            },
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Failed to start callback server';
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errMsg });
        }
      }

      const authUrl = buildAuthorizationUrl({
        codeChallenge,
        state,
        redirectUri,
      });

      return { authUrl, state, mode };
    }),

  /**
   * Start Claude OAuth login flow (Max mode — subscription login).
   * Uses claude.ai/oauth/authorize to authenticate with Pro/Max/Team subscription.
   * Anthropic shows the auth code on screen, user pastes it back.
   */
  startClaudeOAuth: authedProcedure
    .input(z.object({
      provider: z.enum(['anthropic']),
    }))
    .mutation(async ({ ctx }) => {
      const { codeVerifier, codeChallenge } = generateClaudePKCE();
      const state = generateClaudeState();

      // Store PKCE verifier for the completion step
      storePendingFlow(state, {
        codeVerifier,
        userId: ctx.userId,
        redirectUri: 'https://console.anthropic.com/oauth/code/callback',
      });

      // Max mode: claude.ai/oauth/authorize (subscription login like Claude Code)
      const authUrl = buildClaudeAuthorizationUrl({
        codeChallenge,
        state,
        mode: 'max',
      });

      console.log(`[claude-oauth] Max mode OAuth flow started for user ${ctx.userId}, state: ${state}`);

      return { authUrl, state };
    }),

  /**
   * Complete Claude OAuth flow — exchange the authorization code for tokens.
   * Max mode: stores access_token + refresh_token for Bearer auth.
   * The token is used directly with `Authorization: Bearer` header
   * and `anthropic-beta: oauth-2025-04-20`.
   */
  completeClaudeOAuth: authedProcedure
    .input(z.object({
      code: z.string().min(1, 'Authorization code is required'),
      state: z.string().min(1, 'State is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const pendingFlow = getPendingFlow(input.state);
      if (!pendingFlow) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'OAuth session expired or invalid. Please start the login flow again.',
        });
      }

      if (pendingFlow.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'OAuth state mismatch' });
      }

      console.log(`[claude-oauth] Exchanging code for tokens...`);

      // Exchange code for tokens
      let tokens;
      try {
        tokens = await exchangeClaudeCodeForTokens({
          code: input.code.trim(),
          codeVerifier: pendingFlow.codeVerifier,
          state: input.state,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Token exchange failed';
        console.error('[claude-oauth] Token exchange failed:', errMsg);
        if (errMsg.includes('invalid_grant')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid or expired authorization code. Please try signing in again.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Claude authentication failed: ${errMsg}`,
        });
      }

      console.log(`[claude-oauth] Token received. expires_in=${tokens.expires_in}, has_refresh=${!!tokens.refresh_token}`);

      // Max mode: Store access token + refresh token for Bearer auth.
      // Token is used directly as `Authorization: Bearer <token>` with
      // `anthropic-beta: oauth-2025-04-20` header.
      if (!tokens.refresh_token) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'OAuth response missing refresh token. Please try signing in again.',
        });
      }

      await upsertClaudeMaxOAuthCredential({
        clerkUserId: ctx.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        defaultModel: 'claude-sonnet-4-6',
        defaultReasoningEffort: 'medium',
      });

      // Clean up pending flow
      removePendingFlow(input.state);

      console.log(`[claude-oauth] Successfully stored Claude Max tokens for user ${ctx.userId}`);

      return {
        success: true,
        email: null,
        message: 'Claude Max subscription connected! Your subscription quota will be used for AI analysis.',
      };
    }),

  /**
   * Use a Claude setup key (sk-ant-oat01-...) from `claude setup-token`.
   * Validates the key and stores it. If blocked for third-party use,
   * tries to create a proper API key via the console endpoint.
   */
  useClaudeSetupKey: authedProcedure
    .input(z.object({
      setupKey: z.string().min(20, 'Setup key is too short'),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('[claude-oauth] Validating setup key...');

      const result = await validateSetupKey(input.setupKey);

      if (!result.valid && result.error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error,
        });
      }

      // Store the API key
      const { email } = await upsertClaudeOAuthCredential({
        clerkUserId: ctx.userId,
        apiKey: result.apiKey,
        defaultModel: 'claude-sonnet-4-6',
        defaultReasoningEffort: 'medium',
        authMethod: 'api_key',
      });

      return {
        success: true,
        method: result.method,
        email,
        message: result.method === 'created_key'
          ? 'Created a new API key from your setup token.'
          : 'Setup key validated and stored.',
      };
    }),

  /**
   * Disconnect OAuth (remove credential record)
   */
  disconnectOAuth: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);

      const existing = await db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.id, input.id), eq(apiKeys.userId, userDbId)),
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  /**
   * Update an API key's metadata (model, reasoning effort, label, etc.)
   */
  update: authedProcedure
    .input(updateApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);

      const existing = await db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.id, input.id), eq(apiKeys.userId, userDbId)),
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }

      validateModelForProvider(existing.provider, input.model ?? existing.model);

      const updateData: Record<string, unknown> = {};
      if (input.label !== undefined) updateData.label = input.label;
      if (input.model !== undefined) updateData.model = input.model;
      if (input.reasoningEffort !== undefined) updateData.reasoningEffort = input.reasoningEffort;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(apiKeys).set(updateData).where(eq(apiKeys.id, input.id));

      return { success: true };
    }),

  /**
   * Delete an API key
   */
  delete: authedProcedure
    .input(deleteApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);

      const existing = await db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.id, input.id), eq(apiKeys.userId, userDbId)),
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));

      return { success: true };
    }),

  /**
   * Get the decrypted API key / access token for a provider.
   *
   * For Anthropic OAuth (Max mode): returns the access token and
   * auto-refreshes if expired. The caller must use `Authorization: Bearer`
   * header and include `anthropic-beta: oauth-2025-04-20`.
   *
   * Returns `authMethod` so the caller knows how to use the key.
   */
  getKeyForProvider: authedProcedure
    .input(getApiKeyForProviderInput)
    .query(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);

      const key = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.userId, userDbId),
          eq(apiKeys.provider, input.provider),
          eq(apiKeys.isActive, true),
        ),
      });

      if (!key) {
        return { found: false as const, apiKey: null, model: null, authMethod: null, oauthBetaHeader: null };
      }

      // Defensive guard: never return a key for a provider other than requested,
      // even if an unexpected DB row is returned.
      if (key.provider !== input.provider) {
        console.warn(
          `[api-keys] Provider mismatch for user=${ctx.userId}: requested=${input.provider}, returned=${key.provider}`,
        );
        return { found: false as const, apiKey: null, model: null, authMethod: null, oauthBetaHeader: null };
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));

      // Manual API key
      if (key.authMethod === 'api_key' && key.encryptedKey) {
        return {
          found: true as const,
          apiKey: decrypt(key.encryptedKey),
          model: key.model,
          authMethod: 'api_key' as const,
          oauthBetaHeader: null,
        };
      }

      // OAuth — return access token (with auto-refresh for Claude Max)
      if (key.authMethod === 'oauth' && key.encryptedAccessToken) {
        let accessToken = decrypt(key.encryptedAccessToken);

        // Check if token is expired (with 5-minute buffer)
        const isExpired = key.tokenExpiresAt
          ? new Date().getTime() > key.tokenExpiresAt.getTime() - 5 * 60 * 1000
          : false;

        // Auto-refresh for Claude (Anthropic) OAuth tokens
        if (isExpired && input.provider === 'anthropic' && key.encryptedRefreshToken) {
          console.log('[claude-oauth] Access token expired, refreshing...');
          try {
            const refreshToken = decrypt(key.encryptedRefreshToken);
            const newTokens = await refreshClaudeAccessToken(refreshToken);
            accessToken = newTokens.access_token;

            // Save new tokens (Anthropic refresh tokens are single-use)
            const updateData: Record<string, unknown> = {
              encryptedAccessToken: encrypt(newTokens.access_token),
              tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
            };
            if (newTokens.refresh_token) {
              updateData.encryptedRefreshToken = encrypt(newTokens.refresh_token);
            }
            await db.update(apiKeys).set(updateData).where(eq(apiKeys.id, key.id));
            console.log('[claude-oauth] Token refreshed successfully');
          } catch (refreshErr) {
            console.error('[claude-oauth] Token refresh failed:', refreshErr);
            // Token is expired and can't be refreshed — user needs to re-authenticate
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Claude session expired. Please reconnect your subscription in Settings.',
            });
          }
        }

        return {
          found: true as const,
          apiKey: accessToken,
          model: key.model,
          authMethod: 'oauth' as const,
          // For Anthropic OAuth (Max mode), caller needs this beta header
          oauthBetaHeader: input.provider === 'anthropic' ? CLAUDE_OAUTH_BETA_HEADER : null,
        };
      }

      return { found: false as const, apiKey: null, model: null, authMethod: null, oauthBetaHeader: null };
    }),
});
