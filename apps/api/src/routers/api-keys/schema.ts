import { z } from 'zod';

export const addApiKeyInput = z.object({
  provider: z.enum(['openai', 'anthropic']),
  apiKey: z.string().min(10, 'API key is too short').max(200),
  label: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
});

export const updateApiKeyInput = z.object({
  id: z.string().uuid(),
  label: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const deleteApiKeyInput = z.object({
  id: z.string().uuid(),
});

export const getApiKeyForProviderInput = z.object({
  provider: z.enum(['openai', 'anthropic']),
});
