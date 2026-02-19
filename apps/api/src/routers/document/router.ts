import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, users } from '@estimate-pro/db/schema';

import { authedProcedure, orgProcedure, router } from '../../trpc/trpc';
import { extractTasksFromText } from '../../services/document/task-extractor';
import type { AIProviderConfig } from '../../services/document/task-extractor';
import { decrypt } from '../../services/crypto';

import { analyzeTextInput, bulkCreateTasksInput } from './schema';
import { documentService } from './service';

/**
 * Look up the user's active AI API key
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

  // Pick first active key
  const [key] = keys;
  if (!key) return null;

  try {
    return {
      provider: key.provider,
      apiKey: decrypt(key.encryptedKey),
      model: key.model ?? undefined,
    };
  } catch {
    console.error('[document-router] Failed to decrypt API key');
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
        // Look up user's AI config from their saved API keys
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
