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
