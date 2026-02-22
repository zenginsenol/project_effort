import { z } from 'zod';

export const createInvitationInput = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const listInvitationsInput = z.object({
  organizationId: z.string().uuid(),
});

export const cancelInvitationInput = z.object({
  invitationId: z.string().uuid(),
});

export const resendInvitationInput = z.object({
  invitationId: z.string().uuid(),
});

export const acceptInvitationInput = z.object({
  token: z.string().min(1),
});
