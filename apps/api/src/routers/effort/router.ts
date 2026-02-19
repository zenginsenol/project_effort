import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import {
  effortApplyRoadmapInput,
  effortCalculateInput,
  effortRoadmapInput,
} from './schema';
import { effortService } from './service';

export const effortRouter = router({
  calculate: orgProcedure
    .input(effortCalculateInput)
    .query(async ({ ctx, input }) => {
      try {
        return await effortService.calculateProjectEffort(
          input.projectId,
          ctx.orgId,
          input.hourlyRate,
          input.currency,
          input.contingencyPercent,
          input.workHoursPerDay,
        );
      } catch {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
    }),

  roadmap: orgProcedure
    .input(effortRoadmapInput)
    .query(async ({ ctx, input }) => {
      try {
        return await effortService.generateRoadmap(
          input.projectId,
          ctx.orgId,
          input.contingencyPercent,
          input.workHoursPerDay,
          input.includeCompleted,
        );
      } catch {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
    }),

  applyRoadmap: orgProcedure
    .input(effortApplyRoadmapInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await effortService.applyRoadmapToKanban(
          input.projectId,
          ctx.orgId,
          input.contingencyPercent,
          input.workHoursPerDay,
          input.includeCompleted,
          input.autoMoveFirstWeekToTodo,
        );
      } catch {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
    }),
});
