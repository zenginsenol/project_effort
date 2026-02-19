import { z } from 'zod';

export const createOrganizationInput = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export const updateOrganizationInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const getOrganizationInput = z.object({
  id: z.string().uuid(),
});
