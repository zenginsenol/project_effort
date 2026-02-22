import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { organizations, users } from '@estimate-pro/db/schema';

import { sendInvitationEmail } from '../../services/email';
import { orgProcedure, publicProcedure, router } from '../../trpc/trpc';

import {
  acceptInvitationInput,
  cancelInvitationInput,
  createInvitationInput,
  listInvitationsInput,
  resendInvitationInput,
} from './schema';
import { invitationService } from './service';

export const invitationRouter = router({
  create: orgProcedure
    .input(createInvitationInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }

      // Get inviter details
      const inviter = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!inviter) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inviter not found' });
      }

      // Create invitation
      const invitation = await invitationService.createInvitation({
        organizationId: ctx.orgId,
        email: input.email,
        role: input.role,
        invitedBy: inviter.id,
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create invitation',
        });
      }

      // Get organization details for the email
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.orgId),
      });

      // Send invitation email
      const inviterName =
        [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email;
      const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;

      await sendInvitationEmail({
        to: input.email,
        inviterName,
        organizationName: org?.name || 'the organization',
        invitationUrl,
        role: input.role,
      });

      return invitation;
    }),

  list: orgProcedure.input(listInvitationsInput).query(async ({ ctx, input }) => {
    if (input.organizationId !== ctx.orgId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
    }
    return invitationService.listInvitations(ctx.orgId);
  }),

  cancel: orgProcedure
    .input(cancelInvitationInput)
    .mutation(async ({ ctx, input }) => {
      // Get invitation to verify ownership
      const invitation = await invitationService.getInvitationById(input.invitationId);

      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
      }

      if (invitation.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }

      const cancelled = await invitationService.cancelInvitation(input.invitationId);

      if (!cancelled) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel invitation',
        });
      }

      return cancelled;
    }),

  resend: orgProcedure
    .input(resendInvitationInput)
    .mutation(async ({ ctx, input }) => {
      // Get invitation to verify ownership
      const invitation = await invitationService.getInvitationById(input.invitationId);

      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
      }

      if (invitation.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }

      // Resend invitation (generates new token and extends expiration)
      const resent = await invitationService.resendInvitation(input.invitationId);

      if (!resent) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resend invitation',
        });
      }

      // Get inviter and organization details for the email
      const inviter = await db.query.users.findFirst({
        where: eq(users.id, invitation.invitedBy),
      });

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, invitation.organizationId),
      });

      // Send new invitation email with new token
      const inviterName = inviter
        ? [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email
        : 'Team Admin';
      const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${resent.token}`;

      await sendInvitationEmail({
        to: invitation.email,
        inviterName,
        organizationName: org?.name || 'the organization',
        invitationUrl,
        role: invitation.role,
      });

      return resent;
    }),

  accept: publicProcedure
    .input(acceptInvitationInput)
    .mutation(async ({ input }) => {
      // Get invitation by token
      const invitation = await invitationService.getInvitationByToken(input.token);

      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation is no longer valid' });
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        await invitationService.markAsExpired(invitation.id);
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired' });
      }

      // Accept invitation
      const accepted = await invitationService.acceptInvitation(input.token);

      if (!accepted) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to accept invitation',
        });
      }

      return accepted;
    }),
});
