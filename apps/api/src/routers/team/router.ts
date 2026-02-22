import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { inviteMemberInput, listMembersInput, removeMemberInput, updateMemberRoleInput } from './schema';
import { teamService } from './service';

export const teamRouter = router({
  addMember: orgProcedure
    .input(inviteMemberInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const member = await teamService.addMember({ ...input, organizationId: ctx.orgId }, ctx.userId);
      if (!member) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add member' });
      }
      return member;
    }),

  updateRole: orgProcedure
    .input(updateMemberRoleInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const member = await teamService.updateRole(ctx.orgId, input.userId, input.role);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }
      return member;
    }),

  removeMember: orgProcedure
    .input(removeMemberInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const member = await teamService.removeMember(ctx.orgId, input.userId, ctx.userId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }
      return member;
    }),

  list: orgProcedure
    .input(listMembersInput)
    .query(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      return teamService.listMembers(ctx.orgId);
    }),
});
