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
  resolveOAuthMode,
  startCallbackServer,
} from '../../services/oauth/openai-oauth';
import type { OAuthResult } from '../../services/oauth/openai-oauth';
import { upsertOpenAIOAuthCredential, upsertClaudeOAuthCredential } from '../../services/oauth/oauth-credential-store';
import { storePendingFlow, getPendingFlow, removePendingFlow } from '../../services/oauth/oauth-store';
import {
  generateClaudePKCE,
  generateClaudeState,
  buildClaudeAuthorizationUrl,
  exchangeClaudeCodeForTokens,
  createApiKeyFromOAuth,
  validateSetupKey,
} from '../../services/oauth/claude-oauth';

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
   * Add a new API key (manual entry) - supports openai, anthropic, openrouter
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
                  defaultModel: 'gpt-5.2',
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
   * Start Claude OAuth login flow.
   * Generates PKCE + auth URL. No callback server needed —
   * Anthropic shows the auth code on screen, user pastes it back
   * into the UI, then completeClaudeOAuth exchanges it for tokens.
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

      const authUrl = buildClaudeAuthorizationUrl({
        codeChallenge,
        state,
      });

      console.log(`[claude-oauth] OAuth flow started for user ${ctx.userId}, state: ${state}`);

      return { authUrl, state };
    }),

  /**
   * Complete Claude OAuth flow — exchange the authorization code for tokens.
   * Called after user pastes the code from Anthropic's authorization page.
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
        // Parse Anthropic-specific errors for better UX
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

      // Try to create a real API key, fall back to direct token
      let apiKey: string;
      try {
        const keyResult = await createApiKeyFromOAuth(tokens.access_token);
        apiKey = keyResult.api_key;
        console.log(`[claude-oauth] Created API key: ${keyResult.name}`);
      } catch {
        console.log('[claude-oauth] Using access token directly as API key');
        apiKey = tokens.access_token;
      }

      // Store the credential
      const { email } = await upsertClaudeOAuthCredential({
        clerkUserId: ctx.userId,
        apiKey,
        defaultModel: 'claude-sonnet-4-6',
        defaultReasoningEffort: 'medium',
        authMethod: 'api_key',
      });

      // Clean up pending flow
      removePendingFlow(input.state);

      console.log(`[claude-oauth] Successfully stored Claude credential for user ${ctx.userId}`);

      return {
        success: true,
        email,
        message: 'Claude connected successfully!',
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
