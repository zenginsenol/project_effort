import { z } from 'zod';

export const createPublicApiKeyInput = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rateLimit: z.number().int().min(1).max(10000).optional(),
});

export const updatePublicApiKeyInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export const deletePublicApiKeyInput = z.object({
  id: z.string().uuid(),
});

export const rotatePublicApiKeyInput = z.object({
  id: z.string().uuid(),
});
