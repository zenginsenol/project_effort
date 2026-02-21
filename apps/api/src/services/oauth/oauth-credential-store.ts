import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, users } from '@estimate-pro/db/schema';

import { encrypt } from '../crypto';

import { decodeJwtPayload } from './openai-oauth';
import type { TokenResponse } from './openai-oauth';

export async function upsertOpenAIOAuthCredential(params: {
  clerkUserId: string;
  tokens: TokenResponse;
  defaultModel?: string;
  defaultReasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}): Promise<{ email: string | null }> {
  const defaultModel = params.defaultModel ?? 'gpt-5.2';

  let email: string | null = null;
  try {
    if (params.tokens.id_token) {
      const payload = decodeJwtPayload(params.tokens.id_token);
      email = typeof payload.email === 'string' ? payload.email : null;
    }
  } catch {
    // ignore JWT decode errors
  }

  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, params.clerkUserId),
  });

  if (!user) {
    throw new Error(`User not found in DB: ${params.clerkUserId}`);
  }

  const existing = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.userId, user.id),
      eq(apiKeys.provider, 'openai'),
    ),
  });

  const encryptedRefreshToken = params.tokens.refresh_token
    ? encrypt(params.tokens.refresh_token)
    : existing?.encryptedRefreshToken ?? null;

  if (!encryptedRefreshToken) {
    throw new Error('OAuth failed: missing refresh token');
  }

  const tokenData = {
    authMethod: 'oauth' as const,
    encryptedAccessToken: encrypt(params.tokens.access_token),
    encryptedRefreshToken,
    tokenExpiresAt: new Date(Date.now() + params.tokens.expires_in * 1000),
    oauthEmail: email,
    encryptedKey: null,
    keyHint: email ? `OAuth: ${email}` : 'OAuth Connected',
    label: email ? `ChatGPT (${email})` : 'ChatGPT Subscription',
    model: defaultModel,
    reasoningEffort: params.defaultReasoningEffort ?? 'medium',
    isActive: true,
  };

  if (existing) {
    await db.update(apiKeys).set(tokenData).where(eq(apiKeys.id, existing.id));
  } else {
    await db.insert(apiKeys).values({
      userId: user.id,
      provider: 'openai',
      ...tokenData,
    });
  }

  return { email };
}

/**
 * Upsert Claude OAuth credential - stores the API key from Console mode OAuth flow
 * or the setup key directly. Clears any existing OAuth tokens.
 */
export async function upsertClaudeOAuthCredential(params: {
  clerkUserId: string;
  apiKey: string;
  email?: string | null;
  defaultModel?: string;
  defaultReasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  authMethod?: 'oauth' | 'api_key';
}): Promise<{ email: string | null }> {
  const defaultModel = params.defaultModel ?? 'claude-sonnet-4-6';
  const email = params.email ?? null;

  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, params.clerkUserId),
  });

  if (!user) {
    throw new Error(`User not found in DB: ${params.clerkUserId}`);
  }

  const existing = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.userId, user.id),
      eq(apiKeys.provider, 'anthropic'),
    ),
  });

  const keyData = {
    authMethod: params.authMethod ?? 'api_key',
    encryptedKey: encrypt(params.apiKey),
    keyHint: params.apiKey.startsWith('sk-ant-oat')
      ? `OAuth: ${email || 'Claude Subscription'}`
      : `...${params.apiKey.slice(-4)}`,
    label: email ? `Claude (${email})` : 'Claude Subscription',
    model: defaultModel,
    reasoningEffort: params.defaultReasoningEffort ?? 'medium',
    isActive: true,
    oauthEmail: email,
    // Clear any existing OAuth tokens since we're storing API key directly
    encryptedAccessToken: null,
    encryptedRefreshToken: null,
    tokenExpiresAt: null,
  };

  if (existing) {
    await db.update(apiKeys).set(keyData).where(eq(apiKeys.id, existing.id));
  } else {
    await db.insert(apiKeys).values({
      userId: user.id,
      provider: 'anthropic',
      ...keyData,
    });
  }

  return { email };
}

/**
 * Upsert Claude Max subscription credential.
 * Stores OAuth access token + refresh token for Bearer auth.
 * This is the "Max mode" flow — token is used directly for API calls
 * with `Authorization: Bearer` + `anthropic-beta: oauth-2025-04-20`.
 */
export async function upsertClaudeMaxOAuthCredential(params: {
  clerkUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  defaultModel?: string;
  defaultReasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}): Promise<{ email: string | null }> {
  const defaultModel = params.defaultModel ?? 'claude-sonnet-4-6';

  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, params.clerkUserId),
  });

  if (!user) {
    throw new Error(`User not found in DB: ${params.clerkUserId}`);
  }

  const existing = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.userId, user.id),
      eq(apiKeys.provider, 'anthropic'),
    ),
  });

  const tokenData = {
    authMethod: 'oauth' as const,
    encryptedAccessToken: encrypt(params.accessToken),
    encryptedRefreshToken: encrypt(params.refreshToken),
    tokenExpiresAt: new Date(Date.now() + params.expiresIn * 1000),
    keyHint: 'OAuth: Claude Max Subscription',
    label: 'Claude Max Subscription',
    model: defaultModel,
    reasoningEffort: params.defaultReasoningEffort ?? 'medium',
    isActive: true,
    oauthEmail: null,
    // Clear any manual API key data
    encryptedKey: null,
  };

  if (existing) {
    await db.update(apiKeys).set(tokenData).where(eq(apiKeys.id, existing.id));
  } else {
    await db.insert(apiKeys).values({
      userId: user.id,
      provider: 'anthropic',
      ...tokenData,
    });
  }

  return { email: null };
}
