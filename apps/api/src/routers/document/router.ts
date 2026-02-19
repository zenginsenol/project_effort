import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, users } from '@estimate-pro/db/schema';

import { authedProcedure, orgProcedure, router } from '../../trpc/trpc';
import { extractTasksFromText } from '../../services/document/task-extractor';
import type { AIProviderConfig } from '../../services/document/task-extractor';
import { encrypt, decrypt } from '../../services/crypto';
import { refreshAccessToken, isTokenExpired } from '../../services/oauth/openai-oauth';

import { analyzeTextInput, bulkCreateTasksInput } from './schema';
import { documentService } from './service';

/**
 * Look up the user's active AI config - supports both API key and OAuth token
 */
async function getUserAIConfig(clerkId: string): Promise<AIProviderConfig | null> {
  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, clerkId),
  });

  if (!user) return null;

  // Find active keys for this user
  const keys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), eq(apiKeys.isActive, true)));

  if (keys.length === 0) return null;

  const [key] = keys;
  if (!key) return null;

  try {
    // OAuth flow - use access token (with auto-refresh)
    if (key.authMethod === 'oauth' && key.encryptedAccessToken) {
      let accessToken = decrypt(key.encryptedAccessToken);

      // Auto-refresh if token is expired or about to expire
      if (key.tokenExpiresAt && isTokenExpired(key.tokenExpiresAt) && key.encryptedRefreshToken) {
        console.log('[document-router] OAuth token expired, refreshing...');
        try {
          const refreshToken = decrypt(key.encryptedRefreshToken);
          const tokens = await refreshAccessToken(refreshToken);
          const nextRefreshToken = tokens.refresh_token ?? refreshToken;

          // Update stored tokens
          await db.update(apiKeys).set({
            encryptedAccessToken: encrypt(tokens.access_token),
            encryptedRefreshToken: encrypt(nextRefreshToken),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          }).where(eq(apiKeys.id, key.id));

          accessToken = tokens.access_token;
          console.log('[document-router] OAuth token refreshed successfully');
        } catch (refreshErr) {
          console.error('[document-router] Token refresh failed:', refreshErr);
          // Mark as inactive so user knows to re-auth
          await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, key.id));
          return null;
        }
      }

      return {
        provider: key.provider,
        apiKey: accessToken,
        model: key.model ?? undefined,
      };
    }

    // API key flow
    if (key.encryptedKey) {
      return {
        provider: key.provider,
        apiKey: decrypt(key.encryptedKey),
        model: key.model ?? undefined,
      };
    }

    return null;
  } catch {
    console.error('[document-router] Failed to decrypt credentials');
    return null;
  }
}

export const documentRouter = router({
  /**
   * Analyze pasted text (PRD, requirements, etc.) and extract tasks via AI
   */
  analyzeText: authedProcedure
    .input(analyzeTextInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Look up user's AI config (API key or OAuth token)
        const aiConfig = await getUserAIConfig(ctx.userId);

        const result = await extractTasksFromText(
          input.text,
          input.projectContext,
          input.hourlyRate,
          aiConfig,
        );
        return result;
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to analyze document',
        });
      }
    }),

  /**
   * Bulk create tasks in a project (used after AI extraction or manual entry)
   */
  bulkCreateTasks: orgProcedure
    .input(bulkCreateTasksInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await documentService.bulkCreateTasks(input.projectId, input.tasks, ctx.orgId);
        return {
          created: created.length,
          tasks: created,
        };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to create tasks',
        });
      }
    }),
});
