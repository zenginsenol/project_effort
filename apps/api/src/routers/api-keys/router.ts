import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@estimate-pro/db';
import { apiKeys, users } from '@estimate-pro/db/schema';

import { authedProcedure, router } from '../../trpc/trpc';
import { encrypt, decrypt, getKeyHint } from '../../services/crypto';
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  getCallbackUrl,
} from '../../services/oauth/openai-oauth';
import { storePendingFlow } from '../../services/oauth/oauth-store';

import {
  addApiKeyInput,
  updateApiKeyInput,
  deleteApiKeyInput,
  getApiKeyForProviderInput,
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
   * Add a new API key (manual entry)
   */
  add: authedProcedure
    .input(addApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const userDbId = await resolveUserDbId(ctx.userId);

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
          label: input.label || `${input.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key`,
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
   * Start OpenAI OAuth login flow - returns URL to redirect user to
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
      const redirectUri = getCallbackUrl();

      // Store PKCE state for callback verification
      storePendingFlow(state, {
        codeVerifier,
        userId: ctx.userId,
        redirectUri,
      });

      const authUrl = buildAuthorizationUrl({
        codeChallenge,
        state,
        redirectUri,
      });

      return { authUrl, state };
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
   * Update an API key's metadata
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

      const updateData: Record<string, unknown> = {};
      if (input.label !== undefined) updateData.label = input.label;
      if (input.model !== undefined) updateData.model = input.model;
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
   * Get the decrypted API key for a provider
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
        return { found: false as const, apiKey: null, model: null };
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));

      if (key.authMethod === 'api_key' && key.encryptedKey) {
        return {
          found: true as const,
          apiKey: decrypt(key.encryptedKey),
          model: key.model,
        };
      }

      // OAuth - return access token
      if (key.encryptedAccessToken) {
        return {
          found: true as const,
          apiKey: decrypt(key.encryptedAccessToken),
          model: key.model,
        };
      }

      return { found: false as const, apiKey: null, model: null };
    }),
});
