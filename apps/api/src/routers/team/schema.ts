import { z } from 'zod';

export const inviteMemberInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const updateMemberRoleInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export const removeMemberInput = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const listMembersInput = z.object({
  organizationId: z.string().uuid(),
});
