import { TRPCError } from '@trpc/server';

import { authedProcedure, orgProcedure, router } from '../../trpc/trpc';

import { createOrganizationInput, getOrganizationInput, updateOrganizationInput } from './schema';
import { organizationService } from './service';

export const organizationRouter = router({
  create: authedProcedure
    .input(createOrganizationInput)
    .mutation(async ({ input }) => {
      const org = await organizationService.create(input);
      if (!org) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create organization' });
      }
      return org;
    }),

  getById: orgProcedure
    .input(getOrganizationInput)
    .query(async ({ ctx, input }) => {
      if (input.id !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const org = await organizationService.getById(input.id, ctx.orgId);
      if (!org) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      }
      return org;
    }),

  update: orgProcedure
    .input(updateOrganizationInput)
    .mutation(async ({ ctx, input }) => {
      if (input.id !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const { id, ...data } = input;
      const org = await organizationService.update(id, ctx.orgId, data);
      if (!org) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      }
      return org;
    }),

  list: orgProcedure.query(async ({ ctx }) => {
    return organizationService.list(ctx.orgId);
  }),
});
