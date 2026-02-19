import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { createSprintInput, getSprintInput, listSprintsInput, updateSprintInput } from './schema';
import { sprintService } from './service';

export const sprintRouter = router({
  create: orgProcedure
    .input(createSprintInput)
    .mutation(async ({ ctx, input }) => {
      const sprint = await sprintService.create(ctx.orgId, input);
      if (!sprint) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }
      return sprint;
    }),

  getById: orgProcedure
    .input(getSprintInput)
    .query(async ({ ctx, input }) => {
      const sprint = await sprintService.getById(input.id, ctx.orgId);
      if (!sprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });
      }
      return sprint;
    }),

  update: orgProcedure
    .input(updateSprintInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const sprint = await sprintService.update(id, ctx.orgId, data);
      if (!sprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });
      }
      return sprint;
    }),

  list: orgProcedure
    .input(listSprintsInput)
    .query(async ({ ctx, input }) => {
      return sprintService.listByProject(input.projectId, ctx.orgId);
    }),

  delete: orgProcedure
    .input(getSprintInput)
    .mutation(async ({ ctx, input }) => {
      const sprint = await sprintService.delete(input.id, ctx.orgId);
      if (!sprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' });
      }
      return sprint;
    }),
});
