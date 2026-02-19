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
  // Reserved for schema rollout compatibility; persisted when reasoningEffort column is merged.
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
