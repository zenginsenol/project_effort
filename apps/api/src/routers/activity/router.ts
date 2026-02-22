import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { createActivityInput, getActivityInput, listActivitiesInput } from './schema';
import { activityService } from './service';

export const activityRouter = router({
  create: orgProcedure
    .input(createActivityInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const activity = await activityService.create({
        organizationId: input.organizationId,
        projectId: input.projectId,
        actorId: input.actorId,
        activityType: input.activityType,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      });
      if (!activity) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create activity' });
      }
      return activity;
    }),

  getById: orgProcedure
    .input(getActivityInput)
    .query(async ({ ctx, input }) => {
      const activity = await activityService.getById(input.id, ctx.orgId);
      if (!activity) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
      }
      return activity;
    }),

  list: orgProcedure
    .input(listActivitiesInput)
    .query(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      return activityService.list({
        organizationId: input.organizationId,
        projectId: input.projectId,
        actorId: input.actorId,
        activityType: input.activityType,
        entityType: input.entityType,
        startDate: input.startDate,
        endDate: input.endDate,
        limit: input.limit,
        offset: input.offset,
      });
    }),
});
