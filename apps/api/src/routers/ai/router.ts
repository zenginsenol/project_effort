import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { tasks } from '@estimate-pro/db/schema';

import { orgProcedure, router } from '../../trpc/trpc';
import { hasProjectAccess, hasTaskAccess } from '../../services/security/tenant-access';
import { generateEstimationSuggestion } from '../../services/ai/openai-client';
import { findSimilarTasks, generateAndStoreEmbedding } from '../../services/ai/similarity';
import { sanitizeForAI } from '../../services/ai/sanitizer';

import { findSimilarInput, generateEmbeddingInput, getSuggestionInput } from './schema';

export const aiRouter = router({
  getSuggestion: orgProcedure
    .input(getSuggestionInput)
    .query(async ({ ctx, input }) => {
      const canAccessProject = await hasProjectAccess(input.projectId, ctx.orgId);
      const canAccessTask = await hasTaskAccess(input.taskId, ctx.orgId);
      if (!canAccessProject || !canAccessTask) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });

      if (!task || task.projectId !== input.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }

      const { isInjection } = sanitizeForAI(`${task.title} ${task.description ?? ''}`);
      if (isInjection) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Input contains potentially harmful content' });
      }

      const similarTasks = await findSimilarTasks(
        `${task.title} ${task.description ?? ''}`,
        input.projectId,
        5,
      );

      try {
        const suggestion = await generateEstimationSuggestion(
          task.title,
          task.description ?? '',
          similarTasks,
        );

        return {
          ...suggestion,
          similarTasks,
        };
      } catch (error) {
        return {
          suggestedPoints: null,
          suggestedHours: null,
          confidence: 0,
          reasoning: 'AI service temporarily unavailable. Please try again later.',
          similarTasks,
        };
      }
    }),

  findSimilar: orgProcedure
    .input(findSimilarInput)
    .query(async ({ ctx, input }) => {
      const canAccessProject = await hasProjectAccess(input.projectId, ctx.orgId);
      if (!canAccessProject) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      return findSimilarTasks(input.text, input.projectId, input.limit);
    }),

  generateEmbedding: orgProcedure
    .input(generateEmbeddingInput)
    .mutation(async ({ ctx, input }) => {
      const canAccessTask = await hasTaskAccess(input.taskId, ctx.orgId);
      if (!canAccessTask) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      await generateAndStoreEmbedding(input.taskId, input.title, input.description);
      return { success: true };
    }),
});
