import { z } from 'zod';

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export type InviteMember = z.infer<typeof inviteMemberSchema>;
