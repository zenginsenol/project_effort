import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { createTaskInput, getTaskInput, listTasksInput, updateTaskInput } from './schema';
import { taskService } from './service';

export const taskRouter = router({
  create: orgProcedure
    .input(createTaskInput)
    .mutation(async ({ ctx, input }) => {
      const task = await taskService.create(ctx.orgId, input, ctx.userId);
      if (!task) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }
      return task;
    }),

  getById: orgProcedure
    .input(getTaskInput)
    .query(async ({ ctx, input }) => {
      const task = await taskService.getById(input.id, ctx.orgId);
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return task;
    }),

  update: orgProcedure
    .input(updateTaskInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const task = await taskService.update(id, ctx.orgId, data, ctx.userId);
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return task;
    }),

  list: orgProcedure
    .input(listTasksInput)
    .query(async ({ ctx, input }) => {
      const { projectId, limit, cursor, direction, ...filters } = input;
      return taskService.listByProject(projectId, ctx.orgId, filters, { limit, cursor, direction });
    }),

  delete: orgProcedure
    .input(getTaskInput)
    .mutation(async ({ ctx, input }) => {
      const task = await taskService.delete(input.id, ctx.orgId, ctx.userId);
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return task;
    }),

  reorder: orgProcedure
    .input(updateTaskInput.pick({ id: true, sortOrder: true }))
    .mutation(async ({ ctx, input }) => {
      if (input.sortOrder === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'sortOrder is required' });
      }
      const task = await taskService.reorder(input.id, ctx.orgId, input.sortOrder);
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return task;
    }),
});
