import { z } from 'zod';

export const organizationRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
