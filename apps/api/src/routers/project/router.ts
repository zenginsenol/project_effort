import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';
import { projectProcedure } from '../../middleware/plan-limits';

import { createProjectInput, getProjectInput, listProjectsInput, updateProjectInput } from './schema';
import { projectService } from './service';

export const projectRouter = router({
  create: projectProcedure
    .input(createProjectInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const project = await projectService.create(ctx.orgId, {
        name: input.name,
        key: input.key,
        description: input.description,
        defaultEstimationMethod: input.defaultEstimationMethod,
      }, ctx.userId ?? undefined);
      if (!project) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create project' });
      }
      return project;
    }),

  getById: orgProcedure
    .input(getProjectInput)
    .query(async ({ ctx, input }) => {
      const project = await projectService.getById(input.id, ctx.orgId);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      return project;
    }),

  update: orgProcedure
    .input(updateProjectInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await projectService.update(id, ctx.orgId, data, ctx.userId ?? undefined);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      return project;
    }),

  list: orgProcedure
    .input(listProjectsInput)
    .query(async ({ ctx, input }) => {
      if (input.organizationId && input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const { organizationId, ...pagination } = input;
      return projectService.listByOrganization(ctx.orgId, pagination);
    }),

  delete: orgProcedure
    .input(getProjectInput)
    .mutation(async ({ ctx, input }) => {
      const project = await projectService.delete(input.id, ctx.orgId, ctx.userId ?? undefined);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      return project;
    }),
});
